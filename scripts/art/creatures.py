#!/usr/bin/env python3
"""Batch 'creatures-props-items': animals (turnaround → walk → poses), prop sheets, animated props.

Animals use their own builder (body-mass anchor instead of the head centre, quadruped proportions); prop sheets
cut many props from one generated sheet. Specs: scripts/art/creatures.json (animals, sheets, anims).
Raw images: output/imagegen/raw/creatures-props-items/. Provenance: docs/rebuild/art/creatures-props-items.json.

  python3 scripts/art/creatures.py gen  ref:dog walk:dog pose:dog:sit,lie fly:crow sheet:farm anim:campfire …  (≤3 parallel)
  python3 scripts/art/creatures.py animal <ids…>   # build walk sheets + poses (+ QA previews)
  python3 scripts/art/creatures.py cut <sheet…>    # cut a prop sheet into single raws and build every prop of it
  python3 scripts/art/creatures.py prop <pid…>     # (re)build single/animated props from their raw
Options: --suffix=-v2 (variant raw), --extra="…" (correction), --force
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/art"))
import prompts as P  # noqa: E402
import props as PR  # noqa: E402
import qa  # noqa: E402
from gen import parse_args, run_jobs  # noqa: E402
from lib import (ASSETS, DOCS_ART, PREVIEW, STYLE_REFS, apply_palette, band_center, check_alpha,  # noqa: E402
                 darken_outline, grid_figures, key_out, make_palette, place, rel, save_json, scale_to, sharpen,
                 split_columns, load_json)

AREA = "creatures-props-items"
BASE = ROOT / "output/imagegen/raw" / AREA
RAW_A = BASE / "animals"
RAW_P = BASE / "props"
CUT = BASE / "props-cut"
REFS = DOCS_ART / "refs"
SPRITES = ASSETS / "sprites"
PREV = PREVIEW / "art"
DIRS = ["down", "left", "right", "up"]
FOOT = (32, 60)
CELL = (64, 64)
SPEC = json.loads((Path(__file__).parent / "creatures.json").read_text())
ANIMALS: dict = SPEC["animals"]
SHEETS: dict = SPEC["sheets"]
ANIMS: dict = SPEC["anims"]

SPRITE_REF = STYLE_REFS / "insel-sprites-kim-walk.png"
LIA_REF = REFS / "lia.png"
CAMP_REF = STYLE_REFS / "selantis-first-camp.png"
HOF_REF = STYLE_REFS / "selantis-map-hof.png"

STYLE_ONLY = ("The attached girl character sheet / walk sheet are STYLE references only (pixel density, outline, "
              "shading, palette, sprite scale) — do NOT draw any person.")

A_TURN = ("Animal turnaround reference sheet for a 2D pixel-art RPG: the SAME animal shown three times side by side in "
          "one row — LEFT: front view (head and chest facing the viewer), MIDDLE: strict side profile facing RIGHT, "
          "RIGHT: back view (rear and tail toward the viewer). Full body, standing naturally, all three views at "
          "IDENTICAL scale with the feet on the same baseline, evenly spaced with wide gaps, nothing overlapping, "
          "nothing cut off. Wide landscape image. Natural, realistic animal anatomy and proportions (not cartoonish, "
          "not chibi), correct number of legs, ears, eyes. ")

A_WALK = ("Game animal WALK CYCLE SPRITE SHEET: one square image containing a strict 4x4 grid of 16 full-body figures of "
          "the SAME animal (4 rows x 4 columns, evenly spaced like the attached small walk-sheet reference, every figure "
          "centred in its own invisible square cell, identical scale in all 16 frames, wide empty gaps, nothing "
          "touching, nothing cut off at the edges). Each row is one direction with a 4-frame cycle, feet on a common "
          "baseline per row:\n"
          "ROW 1 (top): facing SOUTH — front view, the animal walks toward the viewer (we see its face and chest).\n"
          "ROW 2: facing WEST — strict side profile moving toward the LEFT edge of the image (head points LEFT).\n"
          "ROW 3: facing EAST — strict side profile moving toward the RIGHT edge of the image (head points RIGHT).\n"
          "ROW 4 (bottom): facing NORTH — back view walking away from the viewer (we see its back, rump and tail).\n")

A_POSE = ("Two full-body game sprites of the SAME animal side by side, at IDENTICAL scale, with their ground contact on "
          "the same horizontal baseline and a wide empty gap between them: LEFT = the animal standing still in strict "
          "side profile facing RIGHT (scale reference); RIGHT = the same animal in the pose described below. Slight "
          "three-quarter top-down game camera, compact readable game sprite with chunky pixels and bold dark outline, "
          "natural anatomy. Nothing cut off. ")

FLY = ("Game sprite ANIMATION STRIP: exactly {n} frames of the SAME bird in flight side by side in ONE row, evenly spaced "
       "with wide gaps, identical scale, the body at the same height in every frame, strict side view flying toward "
       "the RIGHT edge of the image (beak points RIGHT). Wing-flap cycle: {cycle} Compact readable game sprite, chunky "
       "pixels, bold dark outline. ")

SHEET = ("Game PROP SPRITE SHEET for a 2D pixel-art RPG: a strict grid of {cols} columns x {rows} rows of separate, "
         "isolated objects, every object centred in its own invisible cell with wide empty magenta gaps, nothing "
         "touching, nothing overlapping, nothing cut off at the image edges. All objects are seen from the same high "
         "three-quarter top-down camera as the attached landscape reference (we see the tops and the front sides), "
         "soft light from the upper left, painted the way objects look in that map. Each object stands on its own, no "
         "ground patch, no grass tufts, no cast shadow unless stated. Objects in reading order (left to right, top to "
         "bottom): {items}.")

ANIM = ("Single game prop sprite ANIMATION STRIP for a 2D pixel-art RPG, seen from the same high three-quarter top-down "
        "camera as the attached landscape reference: exactly {n} frames of the SAME object side by side in ONE row, "
        "evenly spaced with wide gaps, identical size and identical position of the static parts in every frame, "
        "only the animated part changes ({motion}). Nothing cut off. Object: {desc}")


def corr(extra: str) -> str:
    return f"\nIMPORTANT CORRECTION: {extra}" if extra else ""


def tail(extra: str) -> str:
    return "\n" + P.MAGENTA + "\n" + P.STYLE + " " + P.PALETTE + " " + P.NO_TEXT + corr(extra)


def araw(aid: str, name: str, suffix: str = "") -> Path:
    return RAW_A / aid / f"{name}{suffix}.png"


def aref(aid: str) -> Path:
    return REFS / f"{aid}.png"


# ------------------------------------------------------------------------------------------------ jobs
def jobs_for(spec: str, opts: dict) -> list[dict]:
    kind, key, *rest = spec.split(":")
    suffix, extra, force = opts.get("suffix", ""), opts.get("extra", ""), "force" in opts
    out = []

    def add(target: Path, prompt: str, refs: list[Path], k: str):
        if target.exists() and not force and not suffix:
            print(f"vorhanden (überspringe): {rel(target)}")
            return
        out.append({"target": target, "prompt": prompt, "refs": refs, "kind": k, "id": key})

    if kind == "ref":
        a = ANIMALS[key]
        add(araw(key, "turnaround", suffix), A_TURN + "ANIMAL: " + a["desc"] + " " + STYLE_ONLY + tail(extra),
            [SPRITE_REF, LIA_REF], "turnaround")
    elif kind == "walk":
        a = ANIMALS[key]
        refs = [aref(key), SPRITE_REF] if aref(key).is_file() else [SPRITE_REF]
        add(araw(key, "walk", suffix),
            A_WALK + a["gait"] + " Compact, readable game sprite with chunky pixels and bold dark outline, simple clear "
            "shapes that stay readable when shrunk small. Identical markings, colours and tack in all 16 frames. The "
            "animal must match the attached animal reference sheet exactly.\nANIMAL: " + a["desc"] + " "
            "The attached girl walk sheet is only a LAYOUT/STYLE reference — do NOT draw any person." + tail(extra),
            refs, "walk")
    elif kind == "pose":
        a = ANIMALS[key]
        poses = rest[0].split(",") if rest else list(a.get("poses", {}))
        for pose in poses:
            add(araw(key, f"pose-{pose}", suffix),
                A_POSE + "Pose (RIGHT figure): " + a["poses"][pose] + "\nThe animal must match the attached animal "
                "reference sheet exactly.\nANIMAL: " + a["desc"] + tail(extra),
                [aref(key), SPRITE_REF], f"pose:{pose}")
    elif kind == "fly":
        a = ANIMALS[key]
        add(araw(key, "fly", suffix), FLY.format(n=a["fly"]["frames"], cycle=a["fly"]["cycle"]) +
            "The bird must match the attached reference sheet.\nANIMAL: " + a["desc"] + tail(extra),
            [aref(key), SPRITE_REF], "fly")
    elif kind == "sheet":
        s = SHEETS[key]
        items = "; ".join(f"{i + 1}. {it['desc']}" for i, it in enumerate(s["items"]))
        refs = [STYLE_REFS / r for r in s.get("refs", ["selantis-map-hof.png"])]
        add(RAW_P / f"sheet-{key}{suffix}.png", SHEET.format(cols=s["cols"], rows=s["rows"], items=items) +
            tail(extra + (" " + s["extra"] if s.get("extra") else "")), refs, "prop-sheet")
    elif kind == "anim":
        s = ANIMS[key]
        refs = [STYLE_REFS / r for r in s.get("refs", ["selantis-first-camp.png"])]
        add(RAW_P / f"{key}{suffix}.png", ANIM.format(n=s["frames"], motion=s["motion"], desc=s["desc"]) +
            tail(extra), refs, "prop-anim")
    else:
        raise SystemExit(f"unbekannter Auftrag {spec}")
    return out


# --------------------------------------------------------------------------------------------- animals
def finish(small: Image.Image) -> Image.Image:
    return darken_outline(sharpen(small, 90), 0.6)


def build_ref(aid: str) -> None:
    src = araw(aid, "turnaround")
    if not src.is_file():
        return
    keyed = key_out(Image.open(src))
    fig = keyed.crop(keyed.getchannel("A").getbbox())
    pad = 24
    sheet = Image.new("RGBA", (fig.width + 2 * pad, fig.height + 2 * pad), (214, 210, 202, 255))
    sheet.alpha_composite(fig, (pad, pad))
    sheet = sheet.convert("RGB")
    if sheet.width > 1400:
        sheet = sheet.resize((1400, round(sheet.height * 1400 / sheet.width)), Image.Resampling.LANCZOS)
    REFS.mkdir(parents=True, exist_ok=True)
    sheet.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(aref(aid), optimize=True)
    print(f"OK   Referenz {rel(aref(aid))}")


def body_x(small: Image.Image) -> float:
    """Animals: horizontal anchor = centre of mass of the whole silhouette (head-centre would push a side-view
    quadruped out of the cell)."""
    return band_center(small, 0.0, 1.0)


def fit_scale(row: list[Image.Image], height: int, maxw: int) -> float:
    m = median(c.height for c in row)
    s = height / m
    widest = max(c.width for c in row)
    return min(s, maxw / widest)


def build_walk(aid: str) -> list[Image.Image] | None:
    src = araw(aid, "walk")
    if not src.is_file():
        return None
    a = ANIMALS[aid]
    height = int(a["height"])
    b = a.get("build", {})
    keyed = key_out(Image.open(src))
    grid = grid_figures(keyed, 4, 4, min_area=int(b.get("minArea", 300)))
    mirror = b.get("mirror", {})
    order = b.get("order", {})
    # common scale for all rows (the animal must not change size when it turns); width capped to the cell
    scales = [fit_scale(grid[r], height, 62) for r in range(4)]
    side = min(scales[1], scales[2])
    frames = []
    for r, d in enumerate(DIRS):
        src_d = mirror.get(d, d)
        row = list(grid[DIRS.index(src_d)])
        if d in mirror:
            row = [c.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for c in row]
        if d in order:
            row = [row[i] for i in order[d]]
        s = scales[DIRS.index(src_d)] if d in ("down", "up") else side
        smalls = [finish(scale_to(c, s)) for c in row]
        anchors = [body_x(sm) for sm in smalls]
        for i, (sm, ax) in enumerate(zip(smalls, anchors)):
            frames.append(place(sm, CELL, ax, FOOT, f"{aid}-walk[{d}{i}]"))
    return frames


def build_pose(aid: str, pose: str) -> tuple[Image.Image, dict] | None:
    src = araw(aid, f"pose-{pose}")
    if not src.is_file():
        return None
    a = ANIMALS[aid]
    keyed = key_out(Image.open(src))
    stand, fig = split_columns(keyed, 2)
    scale = min(int(a["height"]) / stand.height, 62 / stand.width)
    small = finish(scale_to(fig, scale))
    if small.width > 62 or small.height > 58:
        s = min(62 / small.width, 58 / small.height)
        small = finish(scale_to(fig, scale * s))
    return place(small, CELL, min(max(body_x(small), small.width - 32), 32), FOOT, f"{aid}-{pose}"), \
        {"scale": round(scale, 4), "size": list(small.size)}


def build_fly(aid: str) -> list[Image.Image] | None:
    src = araw(aid, "fly")
    if not src.is_file():
        return None
    a = ANIMALS[aid]
    n = int(a["fly"]["frames"])
    parts = split_columns(key_out(Image.open(src)), n)
    body = median(p.height for p in parts)
    # scale so that the folded-wing body height matches roughly the walking bird; wingspan follows
    s = min(a["fly"]["height"] / body, 60 / max(p.width for p in parts))
    out = []
    for i, p in enumerate(parts):
        sm = finish(scale_to(p, s))
        cy = a["fly"].get("centerY", 30)
        f = Image.new("RGBA", CELL, (0, 0, 0, 0))
        f.alpha_composite(sm, (round(32 - body_x(sm)), round(cy - sm.height / 2)))
        out.append(f)
    return out


def build_animal(aid: str) -> None:
    a = ANIMALS[aid]
    build_ref(aid)
    frames = build_walk(aid) or []
    poses = {}
    for pose in a.get("poses", {}):
        r = build_pose(aid, pose)
        if r:
            poses[pose] = r
    fly = build_fly(aid) or []
    allf = frames + [f for f, _ in poses.values()] + fly
    if not allf:
        print(f"{aid}: nichts zu bauen")
        return
    pal = make_palette(allf, colors=int(a.get("colors", 40)))
    SPRITES.mkdir(parents=True, exist_ok=True)
    from characters import idle_frames
    if frames:
        frames = [apply_palette(f, pal) for f in frames]
        sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            sheet.alpha_composite(f, ((i % 4) * 64, (i // 4) * 64))
        check_alpha(sheet, f"{aid}-walk")
        sheet.save(SPRITES / f"{aid}-walk.png", optimize=True)
        save_json(SPRITES / f"{aid}-walk.json", {"height": int(a["height"]), "foot": list(FOOT),
                                                 "fps": int(a.get("fps", 8)),
                                                 "idle": a.get("build", {}).get("idleFrames", idle_frames(frames)),
                                                 "kind": "animal"})
        qa.walk_previews(aid, sheet)
        print(f"OK   sprites/{aid}-walk.png")
    for pose, (f, info) in poses.items():
        f = apply_palette(f, pal)
        check_alpha(f, f"{aid}-{pose}")
        f.save(SPRITES / f"{aid}-{pose}.png", optimize=True)
        save_json(SPRITES / f"{aid}-{pose}.json", {"character": aid, "pose": pose, "facing": "right",
                                                   "foot": list(FOOT)})
        print(f"OK   sprites/{aid}-{pose}.png {info}")
    if fly:
        fly = [apply_palette(f, pal) for f in fly]
        strip = Image.new("RGBA", (64 * len(fly), 64), (0, 0, 0, 0))
        for i, f in enumerate(fly):
            strip.alpha_composite(f, (i * 64, 0))
        check_alpha(strip, f"{aid}-fly")
        strip.save(SPRITES / f"{aid}-fly.png", optimize=True)
        save_json(SPRITES / f"{aid}-fly.json", {"character": aid, "pose": "fly", "facing": "right", "frames": len(fly),
                                                "frameW": 64, "fps": int(a["fly"].get("fps", 10)), "loop": True,
                                                "foot": list(FOOT)})
        print(f"OK   sprites/{aid}-fly.png ({len(fly)} frames)")
    contact(aid)


def contact(aid: str) -> None:
    rows = []
    if aref(aid).is_file():
        r = Image.open(aref(aid)).convert("RGBA")
        rows.append(r.resize((round(r.width * 300 / r.height), 300), Image.Resampling.LANCZOS))
    ims = [Image.open(p).convert("RGBA") for p in sorted(SPRITES.glob(f"{aid}-*.png"))]
    for im in ims:
        rows.append(qa.on_color(im, (205, 190, 150, 255), 4))
    if not rows:
        return
    W = max(r.width for r in rows)
    out = Image.new("RGBA", (W, sum(r.height + 12 for r in rows)), (24, 24, 28, 255))
    y = 0
    for r in rows:
        out.alpha_composite(r, (0, y))
        y += r.height + 12
    PREV.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(PREV / f"{aid}-contact.png")
    print(f"     Kontakt {rel(PREV / f'{aid}-contact.png')}")


# ----------------------------------------------------------------------------------------------- props
def cut_sheet(name: str) -> list[str]:
    s = SHEETS[name]
    keyed = key_out(Image.open(RAW_P / f"sheet-{name}.png"), min_area=60)
    grid = grid_figures(keyed, s["rows"], s["cols"], min_area=int(s.get("minArea", 300)))
    CUT.mkdir(parents=True, exist_ok=True)
    done = []
    cells = [c for row in grid for c in row]
    for it, cell in zip(s["items"], cells):
        if it.get("skip"):
            continue
        save_cut(it["id"], cell)
        done.append(it["id"])
    return done


def save_cut(pid: str, cell: Image.Image) -> None:
    pad = 16
    bg = Image.new("RGBA", (cell.width + 2 * pad, cell.height + 2 * pad), (255, 0, 255, 255))
    bg.alpha_composite(cell, (pad, pad))
    bg.convert("RGB").save(CUT / f"{pid}.png")


def prop_opts(it: dict) -> dict:
    o = {"height": str(it["height"])}
    for k in ("footprint", "light", "fps", "frames", "colors", "anchor"):
        if k in it:
            o[k] = str(it[k])
    if it.get("sway"):
        o["sway"] = "1"
    o["desc"] = it["desc"]
    return o


def build_prop(pid: str) -> None:
    it = None
    for s in SHEETS.values():
        for x in s["items"]:
            if x["id"] == pid:
                it = x
    if pid in ANIMS:
        it = ANIMS[pid]
        PR.RAW = RAW_P
    else:
        PR.RAW = CUT
    if it is None:
        raise SystemExit(f"unbekanntes Requisit {pid}")
    side = PR.OUT / f"{pid}.json"
    if side.is_file():  # fresh sidecar from spec (anchor recomputed), keep hand-made extras
        old = load_json(side, {})
        keep = {k: v for k, v in old.items() if k in ("anchors", "lights")}
        save_json(side, keep)
    o = prop_opts(it)
    if it.get("width") and int(it.get("frames", 1)) == 1:  # flat ground items: size by width
        k = key_out(Image.open(PR.RAW / f"{pid}.png"))
        x0, y0, x1, y1 = k.getchannel("A").getbbox()
        o["height"] = str(max(3, round(int(it["width"]) * (y1 - y0) / (x1 - x0))))
    PR.build(pid, o)
    meta = load_json(side, {})
    if int(meta.get("frames", 1)) == 1 and "anchor" not in it:  # furniture legs fool foot_center → bbox centre
        with Image.open(PR.OUT / f"{pid}.png") as im:
            meta["anchor"] = [im.width // 2, im.height]
        save_json(side, meta)


def main(argv: list[str]) -> int:
    args, opts = parse_args(argv)
    if not args:
        print(__doc__)
        return 2
    cmd, rest = args[0], args[1:]
    if cmd == "gen":
        jobs = [j for spec in rest for j in jobs_for(spec, opts)]
        return 0 if run_jobs(jobs, AREA, min(3, int(opts.get("jobs", 3)))) else 1
    if cmd == "animal":
        for aid in rest or list(ANIMALS):
            build_animal(aid)
    elif cmd == "cut":
        for name in rest:
            for pid in cut_sheet(name):
                build_prop(pid)
    elif cmd == "prop":
        for pid in rest:
            build_prop(pid)
    elif cmd == "ref":
        for aid in rest:
            build_ref(aid)
    import build_manifest
    build_manifest.main([])
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

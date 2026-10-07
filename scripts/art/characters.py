#!/usr/bin/env python3
"""Characters: reference sheet → walk sheet → poses → portraits (generate with Codex and/or build).

Usage
  python3 scripts/art/characters.py ref      <ids…>                     # turnaround sheet → docs/rebuild/art/refs/<id>.png
  python3 scripts/art/characters.py walk     <ids…>                     # walk sheet raw → sprites/<id>-walk.png
  python3 scripts/art/characters.py sneak    <ids…>                     # crouch-walk sheet raw → sprites/<id>-sneak.png
  python3 scripts/art/characters.py pose     <ids…> [--poses=sit,lie]   # pose raws → sprites/<id>-<pose>.png
  python3 scripts/art/characters.py portrait <ids…> [--moods=neutral,happy]  # → portraits/<id>[-<mood>].png
  python3 scripts/art/characters.py build    <ids…>                     # only (re)process existing raws
  python3 scripts/art/characters.py promote  <id> <raw-name-with-suffix>  # e.g. promote lia walk-v2
  python3 scripts/art/characters.py list                                # cast + what exists

Options
  --extra="…"      correction appended to the prompt          --suffix=-v2   write a variant raw (compare, then promote)
  --jobs=N         parallel Codex jobs (max 3, default 3)      --build-only   skip generation, just process
  --gen-only       generate raws, do not process               --force        regenerate even if the raw exists
  --area=NAME      provenance file docs/rebuild/art/NAME.json (default: characters)

Raw images:   output/imagegen/raw/art/characters/<id>/{turnaround,walk,sneak,pose-<pose>,portrait-<mood>}[suffix].png
Outputs:      game/public/assets/sprites/<id>-walk.png (+ .json sidecar), sprites/<id>-<pose>.png,
              game/public/assets/portraits/<id>.png, <id>-<mood>.png, docs/rebuild/art/refs/<id>.png
QA previews:  output/imagegen/preview/art/<id>-*.png|gif (see scripts/art/qa.py)
The cast (descriptions, heights, default poses/moods, build overrides) lives in scripts/art/cast.json.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prompts as P  # noqa: E402
from gen import parse_args, run_jobs  # noqa: E402
from lib import (ASSETS, DOCS_ART, PREVIEW, RAW_ROOT, apply_palette, band_center, check_alpha,  # noqa: E402
                 darken_outline, grid_figures, key_out, largest_figure, load_json, make_palette, place, rel,
                 save_json, scale_to, sha, sharpen, split_columns)

RAW = RAW_ROOT / "art/characters"
SPRITES = ASSETS / "sprites"
PORTRAITS = ASSETS / "portraits"
REFS = DOCS_ART / "refs"
PREV = PREVIEW / "art"
DIRS = ["down", "left", "right", "up"]  # sheet rows: south, west, east, north
FOOT = (32, 60)
CELL = (64, 64)
LIE_CELL = (128, 64)
LIE_FOOT = (64, 60)
WIDE_POSES = {"attack", "shoot"}  # weapons need room: 96x64 cell, foot (48, 60)
WIDE_CELL = (96, 64)
WIDE_FOOT = (48, 60)
SNEAK_FRAC = 0.78  # crouch-walk figure height relative to the standing height
ROOT = Path(__file__).resolve().parents[2]


def finish(small: Image.Image) -> Image.Image:
    """Sprite finishing after the area downscale: light unsharp mask (keeps faces readable at ~40 px)
    and a softened dark rim (A/B-tested in output/imagegen/preview/art/ab/)."""
    return darken_outline(sharpen(small, 90), 0.6)


def ref_path(cid: str) -> Path:
    own = REFS / f"{cid}.png"
    pf = P.cast().get(cid, {}).get("portraitFrom")
    if not own.is_file() and pf:  # portrait-only variant (baris-scarred): the base sheet defines the identity
        return REFS / f"{pf['id']}.png"
    return own


def raw_dir(cid: str) -> Path:
    """Raw images of a character: cast.json "rawDir" (batches) or output/imagegen/raw/art/characters/<id>."""
    d = P.cast().get(cid, {}).get("rawDir")
    return ROOT / d if d else RAW / cid


def raw(cid: str, name: str, suffix: str = "") -> Path:
    return raw_dir(cid) / f"{name}{suffix}.png"


def record_file(cid: str) -> Path:
    """Build record / provenance file of a character (cast.json "record", default characters)."""
    return DOCS_ART / f"{P.cast().get(cid, {}).get('record', 'characters')}.json"


def check_sprite(img: Image.Image, cid: str, name: str) -> None:
    """check_alpha with the per-character allowance for intended magenta-like pixels (build.magentaAllow)."""
    try:
        check_alpha(img, name)
    except ValueError as exc:
        allow = int(build_cfg(cid).get("magentaAllow", 0))
        if "magenta" in str(exc) and int(str(exc).split(": ")[1].split()[0]) <= allow:
            print(f"NOTE {exc} (erlaubt: build.magentaAllow={allow})")
            return
        raise


def build_cfg(cid: str) -> dict:
    return P.char(cid).get("build", {})


# ------------------------------------------------------------------------------------------ generation
def jobs_for(kind: str, cid: str, opts: dict) -> list[dict]:
    c = P.char(cid)
    suffix, extra, force = opts.get("suffix", ""), opts.get("extra", ""), "force" in opts
    out: list[dict] = []

    def add(target: Path, prompt: str, refs: list[Path], k: str):
        if target.exists() and not force and not suffix:
            print(f"vorhanden (überspringe, --force zum Neuerzeugen): {rel(target)}")
            return
        out.append({"target": target, "prompt": prompt, "refs": refs, "kind": k, "id": cid})

    if kind == "ref":
        refs = list(P.SPRITE_REFS)
        anchor = c.get("styleAnchor", "lia")
        if c.get("base") and ref_path(c["base"]).is_file():
            refs = [ref_path(c["base"])] + refs
        elif ref_path(anchor).is_file() and cid != anchor:
            refs = refs + [ref_path(anchor)]  # style anchor of the cast
        add(raw(cid, "turnaround", suffix), P.turnaround_prompt(cid, extra), refs, "turnaround")
    elif kind == "walk":
        need_ref(cid)
        add(raw(cid, "walk", suffix), P.walk_prompt(cid, extra), [ref_path(cid)] + P.SPRITE_REFS, "walk")
    elif kind == "sneak":
        need_ref(cid)
        walk_sheet = SPRITES / f"{cid}-walk.png"
        refs = [ref_path(cid)] + ([walk_sheet] if walk_sheet.is_file() else []) + P.SPRITE_REFS
        add(raw(cid, "sneak", suffix), P.sneak_prompt(cid, extra), refs, "sneak")
    elif kind == "pose":
        need_ref(cid)
        poses = opts["poses"].split(",") if opts.get("poses") else c.get("poses", [])
        for pose in poses:
            add(raw(cid, f"pose-{pose}", suffix), P.pose_prompt(cid, pose, extra), [ref_path(cid)] + P.SPRITE_REFS,
                f"pose:{pose}")
    elif kind == "portrait" and c.get("portraitFrom"):
        # Derived portrait (baris-scarred): edit another character's neutral portrait instead of a new painting.
        pf = c["portraitFrom"]
        moods = opts["moods"].split(",") if opts.get("moods") else c.get("moods", ["neutral"])
        if "neutral" in moods:
            prompt = (P.PORTRAIT_MOOD + "CHANGE: " + pf["edit"] + " Expression: cold, grim, hateful stare. "
                      "CHARACTER (for reference): " + c["desc"] + "\n" + P.STYLE + P.correction(extra))
            add(raw(cid, "portrait-neutral", suffix), prompt, [raw(pf["id"], "portrait-neutral"), ref_path(cid)],
                "portrait:neutral")
    elif kind == "portrait":
        need_ref(cid)
        moods = opts["moods"].split(",") if opts.get("moods") else c.get("moods", ["neutral"])
        if "neutral" in moods:
            add(raw(cid, "portrait-neutral", suffix), P.portrait_prompt(cid, "neutral", extra),
                [ref_path(cid), P.portrait_style_ref(cid)], "portrait:neutral")
    return out


def mood_jobs(cid: str, opts: dict) -> list[dict]:
    """Mood variants need the neutral portrait as base reference, so they run after it."""
    c = P.char(cid)
    suffix, extra, force = opts.get("suffix", ""), opts.get("extra", ""), "force" in opts
    moods = opts["moods"].split(",") if opts.get("moods") else c.get("moods", ["neutral"])
    base = raw(cid, "portrait-neutral")
    if not base.is_file():
        print(f"kein neutrales Porträt für {cid}, Stimmungen übersprungen")
        return []
    out = []
    for mood in moods:
        if mood == "neutral":
            continue
        target = raw(cid, f"portrait-{mood}", suffix)
        if target.exists() and not force and not suffix:
            print(f"vorhanden (überspringe): {rel(target)}")
            continue
        out.append({"target": target, "prompt": P.portrait_prompt(cid, mood, extra), "refs": [base, ref_path(cid)],
                    "kind": f"portrait:{mood}", "id": cid})
    return out


def need_ref(cid: str) -> None:
    if not ref_path(cid).is_file():
        raise SystemExit(f"{cid}: Referenzbogen fehlt ({rel(ref_path(cid))}). Erst: characters.py ref {cid}")


# ------------------------------------------------------------------------------------------ processing
def build_ref(cid: str) -> None:
    src = raw(cid, "turnaround", build_cfg(cid).get("turnaroundSuffix", ""))
    if not src.is_file():
        return
    keyed = key_out(Image.open(src))
    box = keyed.getchannel("A").getbbox()
    fig = keyed.crop(box)
    pad = 24
    sheet = Image.new("RGBA", (fig.width + 2 * pad, fig.height + 2 * pad), (214, 210, 202, 255))
    sheet.alpha_composite(fig, (pad, pad))
    sheet = sheet.convert("RGB")
    if sheet.width > 1400:
        s = 1400 / sheet.width
        sheet = sheet.resize((1400, round(sheet.height * s)), Image.Resampling.LANCZOS)
    REFS.mkdir(parents=True, exist_ok=True)
    sheet = sheet.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)  # small, tracked
    sheet.save(ref_path(cid), optimize=True)
    print(f"OK   Referenz {rel(ref_path(cid))}")


def walk_rows(cid: str, sheet: str = "walk") -> tuple[list[list[Image.Image]], dict]:
    cfg = build_cfg(cid) if sheet == "walk" else build_cfg(cid).get(sheet, {})
    src = raw(cid, sheet)
    keyed = key_out(Image.open(src))
    grid = grid_figures(keyed, 4, 4)
    sources = {sheet: grid}
    rows, info = [], {}
    mirror = cfg.get("mirror", {})          # {"left": "right"} → left row = mirrored right row
    row_from = cfg.get("rowFrom", {})       # {"left": "walk-v2"} → left row from another raw of this character
    order = cfg.get("order", {})            # {"down": [0, 3, 2, 1]}
    for r, d in enumerate(DIRS):
        src_dir = mirror.get(d, d)
        name = row_from.get(src_dir, sheet)
        if name not in sources:
            sources[name] = grid_figures(key_out(Image.open(raw(cid, name))), 4, 4)
        row = list(sources[name][DIRS.index(src_dir)])
        if d in mirror:
            row = [c.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for c in row]
        if d in order:
            row = [row[i] for i in order[d]]
        rows.append(row)
        info[d] = f"{name} row {DIRS.index(src_dir) + 1}" + (" mirrored" if d in mirror else "")
    return rows, info


def shrink_row(row: list[Image.Image], height: int) -> list[Image.Image]:
    """Common scale per row (keeps the natural bob within the cycle); single frames that are >7 % off the
    row median are normalised on their own so nothing pulses."""
    hs = [c.height for c in row]
    m = median(hs)
    out = []
    for c in row:
        s = height / (c.height if abs(c.height - m) / m > 0.07 else m)
        out.append(finish(scale_to(c, s)))
    return out


def anchor_x(small: Image.Image, d: str) -> float:
    """Head centre as horizontal anchor (the head should not wobble sideways in a walk cycle)."""
    return band_center(small, 0.02, 0.2)


def build_walk(cid: str, sheet: str = "walk") -> tuple[list[Image.Image], dict] | None:
    """4×4 sheet (rows down, left, right, up): the walk cycle, or the crouch-walk cycle (sheet="sneak")."""
    if not raw(cid, sheet).is_file():
        return None
    height = int(P.char(cid).get("height", 42))
    if sheet == "sneak":
        height = round(height * float(build_cfg(cid).get("sneak", {}).get("frac", SNEAK_FRAC)))
    rows, info = walk_rows(cid, sheet)
    frames = []
    for r, (d, row) in enumerate(zip(DIRS, rows)):
        smalls = shrink_row(row, height)
        heads = [anchor_x(s, d) for s in smalls]
        # Side rows: keep the head fixed. Front/back rows: same, the body is symmetric around it.
        for i, (s, hx) in enumerate(zip(smalls, heads)):
            frames.append(place(s, CELL, hx, FOOT, f"{cid}-{sheet}[{d}{i}]"))
    return frames, {"rows": info, "height": height}


def build_pose(cid: str, pose: str) -> tuple[Image.Image, dict] | None:
    src = raw(cid, f"pose-{pose}")
    if not src.is_file():
        return None
    height = int(P.char(cid).get("height", 42))
    keyed = key_out(Image.open(src))
    lie = pose in ("lie", "sleep", "dead")
    try:
        stand, fig = split_columns(keyed, 2)
        scale = height / stand.height
        method = "pair"
    except ValueError:
        fig = largest_figure(keyed)
        frac = {"sit": 0.66, "kneel": 0.72, "crouch": 0.6, "sit-read": 0.62}.get(pose, 1.0)
        scale = (height / fig.width) if lie else (height * frac / fig.height)
        method = f"single (fraction {frac})"
    small = finish(scale_to(fig, scale))
    wide = pose in set(build_cfg(cid).get("widePoses", WIDE_POSES))
    cell, foot = (LIE_CELL, LIE_FOOT) if lie else (WIDE_CELL, WIDE_FOOT) if wide else (CELL, FOOT)
    if small.width > cell[0] - 2 or small.height > cell[1] - 6:
        s = min((cell[0] - 2) / small.width, (cell[1] - 6) / small.height)
        print(f"WARN {cid}-{pose}: zu groß ({small.size}), auf {s:.2f} verkleinert")
        small = finish(scale_to(fig, scale * s))
    # Weapon poses: the stance (lowest fifth) is the anchor, a swung weapon would pull a full-height centroid.
    ax = small.width / 2 if lie else band_center(small, 0.8, 1.0) if wide else band_center(small, 0.0, 1.0)
    ax = min(max(ax, small.width - (cell[0] - foot[0])), foot[0])  # keep inside the cell
    frame = place(small, cell, ax, foot, f"{cid}-{pose}")
    return frame, {"method": method, "scale": round(scale, 4), "size": list(small.size)}


def build_idle(cid: str) -> dict[str, Image.Image]:
    """Optional (cast.json build.idle = "turnaround"): standing idle frames cut from the turnaround sheet.
    Off by default — turnaround figures are slimmer than walk-sheet figures, so idle ↔ walk pops. The default
    idle is the most 'standing' frame of each walk row (see idle_frames)."""
    if build_cfg(cid).get("idle", "walk") != "turnaround":
        return {}
    src = raw(cid, "turnaround")
    if not src.is_file():
        return {}
    height = int(P.char(cid).get("height", 42))
    front, side, back = split_columns(key_out(Image.open(src)), 3)
    out = {}
    for d, fig in (("down", front), ("right", side), ("up", back)):
        small = finish(scale_to(fig, height / fig.height))
        out[d] = place(small, CELL, anchor_x(small, d), FOOT, f"{cid}-idle-{d}")
    out["left"] = out["right"].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return out


def idle_frames(frames: list[Image.Image]) -> list[int]:
    """Per walk row the frame index whose feet are closest together (narrowest lower 9 rows) = best standing pose."""
    out = []
    for r in range(4):
        widths = []
        for i in range(4):
            a = np.asarray(frames[r * 4 + i].getchannel("A"))[FOOT[1] - 9:FOOT[1]] > 0
            cols = np.nonzero(a.any(axis=0))[0]
            widths.append((cols[-1] - cols[0]) if len(cols) else 99)
        out.append(r * 4 + int(np.argmin(widths)))
    return out


def build_portrait(cid: str, mood: str) -> Path | None:
    src = raw(cid, f"portrait-{mood}")
    if not src.is_file():
        return None
    im = Image.open(src).convert("RGB")
    side = min(im.size)
    left = (im.width - side) // 2
    top = 0 if im.height > im.width else (im.height - side) // 2
    im = im.crop((left, top, left + side, top + side))
    # Two-step reduction keeps pixel edges crisper than one big Lanczos jump.
    if side >= 768:
        im = im.resize((512, 512), Image.Resampling.BOX)
    im = im.resize((256, 256), Image.Resampling.LANCZOS)
    im = im.quantize(colors=160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)  # palette PNG: ~half size
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    dest = PORTRAITS / (f"{cid}.png" if mood == "neutral" else f"{cid}-{mood}.png")
    im.save(dest, optimize=True)
    return dest


def build(cid: str) -> list[str]:
    import qa
    errors: list[str] = []
    c = P.char(cid)
    if c.get("builder") == "rider":  # horse + rider: own fit-to-cell build
        import rider
        rider.rider_build()
        return errors
    SPRITES.mkdir(parents=True, exist_ok=True)
    build_ref(cid)
    meta = {"id": cid, "height": int(c.get("height", 42))}
    walk = None
    try:
        walk = build_walk(cid)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{cid}-walk: {exc}")
    sneak = None
    try:
        sneak = build_walk(cid, "sneak")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"{cid}-sneak: {exc}")
    poses: dict[str, tuple[Image.Image, dict]] = {}
    rd = raw_dir(cid)
    pose_names = sorted({p.name[5:-4] for p in rd.glob("pose-*.png") if "-v" not in p.stem[5:] or
                         p.stem[5:] in P.POSES} & set(P.POSES)) if rd.is_dir() else []
    for pose in pose_names:
        try:
            r = build_pose(cid, pose)
            if r:
                poses[pose] = r
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{cid}-{pose}: {exc}")
    try:
        idle = build_idle(cid) if walk else {}
    except Exception as exc:  # noqa: BLE001
        idle = {}
        errors.append(f"{cid}-idle: {exc}")
    frames = walk[0] if walk else []
    if frames or poses:
        palette = make_palette(frames + (sneak[0] if sneak else []) + [f for f, _ in poses.values()] + list(idle.values()),
                               colors=int(c.get("colors", 44)))
        for d, frame in idle.items():
            frame = apply_palette(frame, palette)
            check_sprite(frame, cid, f"{cid}-idle-{d}")
            frame.save(SPRITES / f"{cid}-idle-{d}.png", optimize=True)
            save_json(SPRITES / f"{cid}-idle-{d}.json", {"facing": d, "foot": list(FOOT)})
        if idle:
            print(f"OK   Stand-Frames {cid}: {', '.join(idle)} (aus dem Referenzbogen)")
        if frames:
            frames = [apply_palette(f, palette) for f in frames]
            sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
            for i, f in enumerate(frames):
                sheet.alpha_composite(f, ((i % 4) * 64, (i // 4) * 64))
            check_sprite(sheet, cid, f"{cid}-walk")
            dest = SPRITES / f"{cid}-walk.png"
            sheet.save(dest, optimize=True)
            save_json(SPRITES / f"{cid}-walk.json", {"height": meta["height"], "foot": list(FOOT), "fps": 8,
                                                     "idle": build_cfg(cid).get("idleFrames", idle_frames(frames))})
            meta["walk"] = {"file": rel(dest), "sha": sha(dest), **walk[1]}
            qa.walk_previews(cid, sheet)
            print(f"OK   {rel(dest)}  rows={walk[1]['rows']}")
        if sneak:
            sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
            for i, f in enumerate(sneak[0]):
                sheet.alpha_composite(apply_palette(f, palette), ((i % 4) * 64, (i // 4) * 64))
            check_sprite(sheet, cid, f"{cid}-sneak")
            dest = SPRITES / f"{cid}-sneak.png"
            sheet.save(dest, optimize=True)
            save_json(SPRITES / f"{cid}-sneak.json", {"character": cid, "sheet": "sneak", "foot": list(FOOT), "fps": 6})
            meta["sneak"] = {"file": rel(dest), "sha": sha(dest), **sneak[1]}
            qa.walk_previews(f"{cid}-sneak", sheet)
            print(f"OK   {rel(dest)}  rows={sneak[1]['rows']}")
        meta["poses"] = {}
        for pose, (frame, info) in poses.items():
            frame = apply_palette(frame, palette)
            check_sprite(frame, cid, f"{cid}-{pose}")
            dest = SPRITES / f"{cid}-{pose}.png"
            frame.save(dest, optimize=True)
            # character/pose named explicitly so ids with dashes (shadow-sword-attack) resolve unambiguously
            save_json(SPRITES / f"{cid}-{pose}.json", {"facing": "right", "foot": [frame.width // 2, FOOT[1]],
                                                      "character": cid, "pose": pose})
            meta["poses"][pose] = {"file": rel(dest), **info}
            print(f"OK   {rel(dest)}  ({info['method']})")
    meta["portraits"] = {}
    for p in sorted(rd.glob("portrait-*.png")) if rd.is_dir() else []:
        mood = p.stem[len("portrait-"):]
        if mood not in P.MOODS:
            continue  # variants (…-v2) are only used after `promote`
        dest = build_portrait(cid, mood)
        if dest:
            meta["portraits"][mood] = rel(dest)
    if meta["portraits"]:
        print(f"OK   Porträts {cid}: {', '.join(meta['portraits'])}")
    qa.character_contact(cid)
    rf = record_file(cid)
    record = load_json(rf, {"area": rf.stem, "images": {}})
    record.setdefault("builds", {})[cid] = meta
    save_json(rf, record)
    return errors


def promote(cid: str, name: str) -> None:
    """Make a variant raw (e.g. walk-v2) the selected raw (walk); the previous one is kept as …-rejected-N."""
    rd = raw_dir(cid)
    src = rd / f"{name}.png"
    if not src.is_file():
        raise SystemExit(f"fehlt: {rel(src)}")
    base = name.rsplit("-v", 1)[0] if "-v" in name else name
    dst = rd / f"{base}.png"
    if dst.exists():
        n = 1
        while (rd / f"{base}-rejected-{n}.png").exists():
            n += 1
        shutil.move(dst, rd / f"{base}-rejected-{n}.png")
    shutil.copy2(src, dst)
    print(f"OK   {rel(src)} → {rel(dst)}")


def main(argv: list[str]) -> int:
    args, opts = parse_args(argv)
    if not args:
        print(__doc__)
        return 2
    kind, ids = args[0], args[1:]
    if kind == "list":
        for cid, c in P.cast().items():
            have = sorted(p.name for p in raw_dir(cid).glob("*.png")) if raw_dir(cid).is_dir() else []
            print(f"{cid:16} h={c.get('height')} ref={'ja' if ref_path(cid).is_file() else 'nein'} raws={len(have)}")
        return 0
    if kind == "promote":
        promote(ids[0], ids[1])
        return 0
    area = opts.get("area") or (P.cast().get(ids[0], {}).get("record", "characters") if ids and kind != "batch" else "characters")
    if kind == "batch":
        # characters.py batch walk:lia pose:kyra:sit,lie portrait:valentus:neutral ref:kyra  → one shared job pool
        jobs, moods, touched = [], [], []
        for spec in ids:
            k, cid, *rest = spec.split(":")
            o = dict(opts)
            if rest and k == "pose":
                o["poses"] = rest[0]
            if rest and k == "portrait":
                o["moods"] = rest[0]
            jobs += jobs_for(k, cid, o)
            if k == "portrait":
                moods.append((cid, o))
            touched.append(cid)
        ok = run_jobs(jobs, area, int(opts.get("jobs", 3)))
        ok &= run_jobs([j for cid, o in moods for j in mood_jobs(cid, o)], area, int(opts.get("jobs", 3)))
        if "gen-only" not in opts:
            for cid in dict.fromkeys(touched):
                build(cid)
            import build_manifest
            build_manifest.main([])
        return 0 if ok else 1
    if not ids:
        ids = list(P.cast())
    ok = True
    if kind in ("ref", "walk", "sneak", "pose", "portrait") and "build-only" not in opts:
        jobs = [j for cid in ids for j in jobs_for(kind, cid, opts)]
        ok &= run_jobs(jobs, area, int(opts.get("jobs", 3)))
        if kind == "portrait":
            ok &= run_jobs([j for cid in ids for j in mood_jobs(cid, opts)], area, int(opts.get("jobs", 3)))
    if "gen-only" in opts:
        return 0 if ok else 1
    errors = []
    for cid in ids:
        errors += build(cid)
    for e in errors:
        print("FEHLER", e)
    if errors or not ok:
        return 1
    try:
        import build_manifest
        build_manifest.main([])
    except Exception as exc:  # noqa: BLE001
        print("WARN Manifest nicht aktualisiert:", exc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""QA helpers: contact sheets, walk-cycle strips with guides + onion skin, animated GIFs, in-scene previews,
and numeric walk-cycle checks (jitter, baseline, motion).

Usage
  python3 scripts/art/qa.py walk <ids…>            # strips, onion skin, GIF + metrics for sprites/<id>-walk.png
  python3 scripts/art/qa.py contact <ids…>         # reference | walk | poses | portraits on one sheet
  python3 scripts/art/qa.py scene <ids…> [--bg=assets/bg/x.png]   # characters on a background, 1× and 3×
  python3 scripts/art/qa.py all                    # everything for every character with a walk sheet
Outputs go to output/imagegen/preview/art/. Look at the PNGs with an image viewer (or the Read tool):
  <id>-walk-strip.png  rows = directions; columns = frames 1-4, then an onion-skin overlay of all 4 frames
                       (a steady head = sharp head in the overlay; legs/arms should fan out) and a
                       lower-body difference bar per transition.
  <id>-walk.gif        all four directions side by side, 8 fps, 4×.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import ASSETS, DOCS_ART, PREVIEW, band_center, checker, on_color  # noqa: E402

PREV = PREVIEW / "art"
SAND = (205, 190, 150, 255)
GRASS = (92, 128, 64, 255)
DARK = (40, 44, 52, 255)
DIRS = ["down", "left", "right", "up"]


def frames_of(sheet: Image.Image) -> list[Image.Image]:
    return [sheet.crop(((i % 4) * 64, (i // 4) * 64, (i % 4) * 64 + 64, (i // 4) * 64 + 64)) for i in range(16)]


def walk_metrics(sheet: Image.Image) -> dict:
    """Per row: visible heights, bottom line, head-x, lower-body motion between consecutive frames, and
    whether frames 1 and 3 differ (legs alternate)."""
    fr = frames_of(sheet)
    out = {}
    for r, d in enumerate(DIRS):
        row = fr[r * 4:(r + 1) * 4]
        boxes = [f.getchannel("A").getbbox() or (0, 0, 0, 0) for f in row]
        heads = [round(band_center(f.crop(b), 0.02, 0.2) + b[0], 1) for f, b in zip(row, boxes)]
        arrs = [np.asarray(f).astype(int)[38:61] for f in row]

        def diff(a, b) -> int:
            """Lower-body pixels that changed (shape or colour) — catches which leg is in front in side views."""
            shape = (a[..., 3] > 0) ^ (b[..., 3] > 0)
            colour = (a[..., 3] > 0) & (b[..., 3] > 0) & (np.abs(a[..., :3] - b[..., :3]).sum(axis=2) > 60)
            return int((shape | colour).sum())

        motion = [diff(arrs[i], arrs[(i + 1) % 4]) for i in range(4)]
        alt = diff(arrs[0], arrs[2])
        out[d] = {"heights": [b[3] - b[1] for b in boxes], "bottoms": [b[3] for b in boxes], "headX": heads,
                  "headJitter": round(max(heads) - min(heads), 1), "lowerMotion": motion, "alternation13": alt}
    return out


def walk_warnings(m: dict) -> list[str]:
    w = []
    for d, v in m.items():
        if v["headJitter"] > 2.5:
            w.append(f"{d}: head jitter {v['headJitter']} px")
        if len(set(v["bottoms"])) > 1:
            w.append(f"{d}: baseline differs {v['bottoms']}")
        if min(v["lowerMotion"]) < 12:
            w.append(f"{d}: almost no leg motion between some frames {v['lowerMotion']}")
        if v["alternation13"] < 25:
            w.append(f"{d}: frames 1 and 3 nearly identical (legs do not alternate) {v['alternation13']}")
        if max(v["heights"]) - min(v["heights"]) > 4:
            w.append(f"{d}: height pulses {v['heights']}")
    return w


def walk_previews(cid: str, sheet: Image.Image | None = None) -> list[str]:
    PREV.mkdir(parents=True, exist_ok=True)
    if sheet is None:
        sheet = Image.open(ASSETS / f"sprites/{cid}-walk.png").convert("RGBA")
    on_color(sheet, SAND, 4).save(PREV / f"{cid}-walk.png")
    fr = frames_of(sheet)
    z = 5
    cw = 64 * z
    strip = Image.new("RGBA", (cw * 5 + 60, cw * 4), SAND)
    dr = ImageDraw.Draw(strip)
    for r in range(4):
        row = fr[r * 4:(r + 1) * 4]
        for i, f in enumerate(row):
            strip.alpha_composite(f.resize((cw, cw), Image.Resampling.NEAREST), (i * cw, r * cw))
        onion = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        for f in row:
            a = np.asarray(f).copy()
            a[..., 3] = (a[..., 3] * 0.4).astype(np.uint8)
            onion.alpha_composite(Image.fromarray(a, "RGBA"))
        strip.alpha_composite(onion.resize((cw, cw), Image.Resampling.NEAREST), (4 * cw + 60, r * cw))
        for i in range(5):
            x0 = i * cw + (60 if i == 4 else 0)
            dr.line([(x0, r * cw + 60 * z), (x0 + cw, r * cw + 60 * z)], fill=(200, 40, 40, 255), width=1)
            dr.line([(x0 + 32 * z, r * cw), (x0 + 32 * z, r * cw + cw)], fill=(40, 40, 200, 160), width=1)
            dr.rectangle([x0, r * cw, x0 + cw - 1, r * cw + cw - 1], outline=(120, 100, 70, 255))
    strip.convert("RGB").save(PREV / f"{cid}-walk-strip.png")
    gif = []
    for i in range(4):
        s = Image.new("RGBA", (256, 64), SAND)
        for r in range(4):
            s.alpha_composite(fr[r * 4 + i], (r * 64, 0))
        gif.append(s.resize((1024, 256), Image.Resampling.NEAREST).convert("P", palette=Image.Palette.ADAPTIVE))
    gif[0].save(PREV / f"{cid}-walk.gif", save_all=True, append_images=gif[1:], duration=125, loop=0)
    m = walk_metrics(sheet)
    warns = walk_warnings(m)
    for d, v in m.items():
        print(f"     {cid} {d:5} h={v['heights']} headX={v['headX']} motion={v['lowerMotion']} alt13={v['alternation13']}")
    for w in warns:
        print(f"WARN {cid}-walk: {w}")
    return warns


def character_contact(cid: str) -> Path | None:
    """Reference | walk sheet (3×) | poses (3×) | portraits — one image per character."""
    parts: list[tuple[str, Image.Image]] = []
    ref = DOCS_ART / f"refs/{cid}.png"
    walk = ASSETS / f"sprites/{cid}-walk.png"
    poses = sorted(p for p in (ASSETS / "sprites").glob(f"{cid}-*.png")
                   if p.name != f"{cid}-walk.png" and not _other_char(cid, p.stem))
    portraits = sorted((ASSETS / "portraits").glob(f"{cid}*.png"))
    portraits = [p for p in portraits if p.stem == cid or (p.stem.startswith(cid + "-") and
                                                           not _other_char(cid, p.stem))]
    if not (walk.exists() or poses or portraits):
        return None
    W = 1800
    rows: list[Image.Image] = []
    if ref.exists():
        r = Image.open(ref).convert("RGBA")
        r = r.resize((round(r.width * 360 / r.height), 360), Image.Resampling.LANCZOS)
        rows.append(r)
    if walk.exists():
        rows.append(on_color(Image.open(walk).convert("RGBA"), SAND, 3))
    if poses:
        ims = [on_color(Image.open(p).convert("RGBA"), SAND, 3) for p in poses]
        row = Image.new("RGBA", (sum(i.width + 12 for i in ims), max(i.height for i in ims)), (30, 30, 30, 255))
        x = 0
        for i in ims:
            row.alpha_composite(i, (x, 0))
            x += i.width + 12
        rows.append(row)
    if portraits:
        ims = [Image.open(p).convert("RGBA").resize((200, 200), Image.Resampling.LANCZOS) for p in portraits]
        row = Image.new("RGBA", (len(ims) * 208, 200), (30, 30, 30, 255))
        for k, i in enumerate(ims):
            row.alpha_composite(i, (k * 208, 0))
        rows.append(row)
    W = max(W, max(r.width for r in rows))
    out = Image.new("RGBA", (W, sum(r.height + 16 for r in rows)), (24, 24, 28, 255))
    y = 0
    for r in rows:
        out.alpha_composite(r, (0, y))
        y += r.height + 16
    PREV.mkdir(parents=True, exist_ok=True)
    dest = PREV / f"{cid}-contact.png"
    out.convert("RGB").save(dest)
    return dest


def _other_char(cid: str, stem: str) -> bool:
    """True if `stem` belongs to a longer character id (e.g. lia-cloak-* when looking at lia)."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import prompts
    rest = stem[len(cid) + 1:]
    return any(o != cid and o.startswith(cid + "-") and stem.startswith(o) for o in prompts.cast()) or \
        rest.startswith("v") and rest[1:].isdigit()


def scene_preview(ids: list[str], bg: str | None) -> Path:
    """Characters (idle + walk frames of every direction, plus poses) over a background at 1× and 3×."""
    base = Image.open(ASSETS.parent / bg).convert("RGBA") if bg else checker((640, 360))
    base = base.resize((640, 360)) if base.size != (640, 360) else base
    canvas = base.copy()
    x = 40
    for cid in ids:
        walk = ASSETS / f"sprites/{cid}-walk.png"
        if not walk.exists():
            continue
        fr = frames_of(Image.open(walk).convert("RGBA"))
        for r in range(4):
            canvas.alpha_composite(fr[r * 4 + 1], (x + r * 26 - 32, 230 - 60))
        x += 130
    PREV.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(PREV / "scene-1x.png")
    canvas.resize((1920, 1080), Image.Resampling.NEAREST).convert("RGB").save(PREV / "scene-3x.png")
    return PREV / "scene-1x.png"


def main(argv: list[str]) -> int:
    from gen import parse_args
    args, opts = parse_args(argv)
    if not args:
        print(__doc__)
        return 2
    kind, ids = args[0], args[1:]
    if kind == "all" or not ids:
        ids = sorted(p.stem[:-5] for p in (ASSETS / "sprites").glob("*-walk.png"))
    if kind in ("walk", "all"):
        for cid in ids:
            walk_previews(cid)
    if kind in ("contact", "all"):
        for cid in ids:
            print(character_contact(cid))
    if kind == "scene":
        print(scene_preview(ids, opts.get("bg")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

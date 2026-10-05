#!/usr/bin/env python3
"""The mounted Dunkelschatten rider (shadow-rider): horse + rider turnaround and walk sheet need their own prompts
and a fit-to-cell build (the horse is wider than a person; 64x64 cells, ~52 px tall).

  python3 scripts/art/rider.py ref   [--suffix=-v2 --extra="…" --force]   # turnaround raw
  python3 scripts/art/rider.py walk  [--suffix=-v2 --extra="…" --force]   # walk-sheet raw
  python3 scripts/art/rider.py build                                       # sprites/shadow-rider-walk.png + manifest

Raw images and provenance follow cast.json (rawDir / record of shadow-rider).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import characters as C  # noqa: E402
import gen  # noqa: E402
import lib  # noqa: E402
import prompts as P  # noqa: E402

# ------------------------------------------------------------------------------------------- rider
RIDER_REF = (
    "Character turnaround reference sheet for a 2D pixel-art RPG: the SAME MOUNTED RIDER ON HIS HORSE shown three "
    "times side by side in one row — LEFT: front view (horse walking toward the viewer), MIDDLE: strict side profile "
    "with the horse's head pointing RIGHT, RIGHT: back view (horse walking away). Full figures from the top of the "
    "rider's helmet to the horse's hooves, the horse standing calmly, all three views at IDENTICAL scale with the hooves "
    "on the same baseline, evenly spaced with wide gaps, nothing overlapping, nothing cut off. Wide landscape image. ")
RIDER_WALK = (
    "Game WALK CYCLE SPRITE SHEET of a MOUNTED RIDER: one square image containing a strict 4x4 grid of 16 figures of "
    "the SAME rider on the SAME horse (4 rows x 4 columns, evenly spaced, every horse+rider centred in its own "
    "invisible square cell, identical scale in all 16 frames, wide empty gaps, nothing touching, nothing cut off). "
    "Each row is one direction with a 4-frame horse WALK cycle, hooves on a common baseline per row:\n"
    "ROW 1 (top): facing SOUTH — horse walking toward the viewer (front view, we see the horse's face and chest and the rider's front).\n"
    "ROW 2: facing WEST — strict side profile, the horse walks toward the LEFT edge (horse head points LEFT).\n"
    "ROW 3: facing EAST — strict side profile, the horse walks toward the RIGHT edge (horse head points RIGHT).\n"
    "ROW 4 (bottom): facing NORTH — walking away (we see the horse's rump and tail and the rider's back).\n"
    "The 4 frames of every row show a clear four-beat horse walk: the legs move in alternating diagonal pairs, one "
    "hoof lifted in every frame, the head nods slightly, the tail sways; the rider bobs gently. In the side rows the "
    "horse is compact (not too long), so the whole horse fits a square cell. Slight three-quarter top-down game camera. "
    "Compact, readable game sprite with chunky pixels and bold dark outline, readable when shrunk to about 52 pixels "
    "tall. Identical horse, tack, rider clothing and colours in all 16 frames. ")


def rider_job(kind: str, opts: dict) -> dict:
    cid = "shadow-rider"
    c = P.char(cid)
    suffix, extra = opts.get("suffix", ""), opts.get("extra", "")
    if kind == "ref":
        prompt = (RIDER_REF + "CHARACTER: " + c["desc"] + " " + P.PRIVACY + " " + P.MAGENTA + "\n" + P.STYLE + " "
                  + P.PALETTE + " Match the pixel density and outline treatment of the attached sprite references."
                  + P.correction(extra))
        refs = [C.ref_path("valentus")] + P.SPRITE_REFS
        return {"target": C.raw(cid, "turnaround", suffix), "prompt": prompt, "refs": refs, "kind": "turnaround",
                "id": cid}
    prompt = (RIDER_WALK + "Horse and rider must match the attached reference sheet exactly.\nCHARACTER: " + c["desc"]
              + "\n" + P.MAGENTA + "\n" + P.STYLE + " " + P.NO_TEXT + P.correction(extra))
    return {"target": C.raw(cid, "walk", suffix), "prompt": prompt, "refs": [C.ref_path(cid)] + P.SPRITE_REFS,
            "kind": "walk", "id": cid}


def rider_build() -> None:
    """Fit-to-cell build: common scale per row so the row's tallest frame = height and the widest ≤ 62 px;
    horizontal anchor = rider head centre, shifted per row so every frame fits the 64×64 cell."""
    import numpy as np
    from PIL import Image
    import qa
    cid = "shadow-rider"
    c = P.char(cid)
    height = int(c["height"])
    C.build_ref(cid)
    rows, info = C.walk_rows(cid)
    frames = []
    for d, row in zip(C.DIRS, rows):
        hmax = max(f.height for f in row)
        wmax = max(f.width for f in row)
        s = min(height / hmax, 62 / wmax)
        smalls = [C.finish(lib.scale_to(f, s)) for f in row]
        heads = [lib.band_center(sm, 0.0, 0.15) for sm in smalls]
        # x offset of each frame = 32 - head + shift; need 0 <= off and off + w <= 64 for all frames
        need_min = max(h - 32 for h in heads)            # shift ≥ head-32 so left edge ≥ 0
        need_max = min(64 - sm.width - 32 + h for sm, h in zip(smalls, heads))
        shift = 0 if need_min <= 0 <= need_max else (need_min if need_min > 0 else need_max)
        if need_min > need_max:
            shift = (need_min + need_max) / 2
        for i, (sm, hx) in enumerate(zip(smalls, heads)):
            frames.append(lib.place(sm, C.CELL, hx - shift, C.FOOT, f"{cid}-walk[{d}{i}]", strict=False))
        info[d] += f" scale={s:.3f} shift={shift:+.1f}"
    palette = lib.make_palette(frames, colors=int(c.get("colors", 48)))
    frames = [lib.apply_palette(f, palette) for f in frames]
    sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, ((i % 4) * 64, (i // 4) * 64))
    lib.check_alpha(sheet, f"{cid}-walk")
    dest = C.SPRITES / f"{cid}-walk.png"
    sheet.save(dest, optimize=True)
    lib.save_json(C.SPRITES / f"{cid}-walk.json", {"height": height, "foot": list(C.FOOT), "fps": 7,
                                                   "idle": c.get("build", {}).get("idleFrames", C.idle_frames(frames))})
    qa.walk_previews(cid, sheet)
    qa.character_contact(cid)
    rec = lib.load_json(C.record_file(cid), {"area": C.record_file(cid).stem, "images": {}})
    rec.setdefault("builds", {})[cid] = {"id": cid, "height": height, "walk": {"file": lib.rel(dest),
                                         "sha": lib.sha(dest), "rows": info, "note": "custom fit-to-cell build (scripts/art/rider.py build)"}}
    lib.save_json(C.record_file(cid), rec)
    print(f"OK   {lib.rel(dest)} {info}")
    import build_manifest
    build_manifest.main([])
    _ = np


def main(argv: list[str]) -> int:
    args, opts = gen.parse_args(argv)
    kind = args[0] if args else ""
    if kind in ("ref", "walk"):
        ok = gen.run_jobs([rider_job(kind, opts)], P.cast()["shadow-rider"].get("record", "characters"), 1)
        return 0 if ok else 1
    if kind == "build":
        rider_build()
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

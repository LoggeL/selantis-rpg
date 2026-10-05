#!/usr/bin/env python3
"""Props: Codex image on magenta → trimmed transparent PNG with foot anchor (+ optional animation strip).

Usage
  python3 scripts/art/props.py gen   <id> --desc="a wooden water bucket with a rope handle" [--frames=4] [--extra=…] [--suffix=-v2]
  python3 scripts/art/props.py build <id> --height=24 [--footprint=x,y,w,h|none] [--anchor=x,y] [--sway]
                                          [--light=radius,#ffb060[,flicker]] [--frames=4 --fps=8] [--colors=32]
  python3 scripts/art/props.py <id> --desc="…" --height=24 …        # gen + build in one go
  python3 scripts/art/props.py build                                # rebuild every prop from its sidecar
Raw:     output/imagegen/raw/art/props/<id>[suffix].png
Output:  game/public/assets/props/<id>.png + <id>.json sidecar (anchor, footprint, frames, fps, sway, light …)
Build parameters are stored in the sidecar, so a later `build <id>` without options reproduces the asset.
Height = visible height in game pixels (characters are ~40 px: a door ~44, a barrel ~20, a tree 90-140).
Footprint (collision) is relative to the anchor, default = bottom strip 80 % wide, 25 % (max 12 px) high.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prompts as P  # noqa: E402
from gen import parse_args, run_jobs  # noqa: E402
from lib import (ASSETS, PREVIEW, RAW_ROOT, apply_palette, check_alpha, checker, darken_outline, foot_center, key_out,  # noqa: E402
                 largest_figure, load_json, make_palette, rel, save_json, scale_to, sharpen, split_columns)

RAW = RAW_ROOT / "art/props"
OUT = ASSETS / "props"


def gen(pid: str, opts: dict) -> bool:
    desc = opts.get("desc") or load_json(OUT / f"{pid}.json", {}).get("desc")
    if not desc:
        raise SystemExit(f"{pid}: --desc fehlt")
    frames = int(opts.get("frames", 1))
    if frames > 1:
        desc += (f" ANIMATION STRIP: draw exactly {frames} frames of this object side by side in one row, evenly spaced "
                 f"with wide gaps, identical size and position, only the animated part changes from frame to frame.")
    refs = [Path(r) for r in opts["refs"].split(",")] if opts.get("refs") else P.LANDSCAPE_REFS[:1]
    job = {"target": RAW / f"{pid}{opts.get('suffix', '')}.png", "prompt": P.prop_prompt(desc, opts.get("extra", "")),
           "refs": refs, "kind": "prop", "id": pid}
    return run_jobs([job], opts.get("area", "props"), 1)


def build(pid: str, opts: dict) -> None:
    side = OUT / f"{pid}.json"
    meta = load_json(side, {})
    src = RAW / f"{pid}.png"
    if not src.is_file():
        raise SystemExit(f"{pid}: Rohbild fehlt {rel(src)}")
    height = int(opts.get("height", meta.get("height", 32)))
    frames = int(opts.get("frames", meta.get("frames", 1)))
    keyed = key_out(Image.open(src))
    parts = split_columns(keyed, frames) if frames > 1 else [largest_figure(keyed)]
    scale = height / max(p.height for p in parts)
    smalls = [darken_outline(sharpen(scale_to(p, scale), 70), 0.55) for p in parts]
    pal = make_palette(smalls, colors=int(opts.get("colors", meta.get("colors", 40))))
    smalls = [apply_palette(s, pal) for s in smalls]
    # Animation frames are aligned on their base (centre of the bottom rows), so the static part does not jitter.
    feet = [foot_center(s, rows=4) for s in smalls]
    left = max(feet)
    right = max(s.width - f for s, f in zip(smalls, feet))
    fw = int(round(left + right)) + 2
    fh = max(s.height for s in smalls) + 1
    strip = Image.new("RGBA", (fw * frames, fh), (0, 0, 0, 0))
    for i, (s, f) in enumerate(zip(smalls, feet)):
        strip.alpha_composite(s, (i * fw + 1 + int(round(left - f)), fh - s.height))
    check_alpha(strip, pid)
    OUT.mkdir(parents=True, exist_ok=True)
    strip.save(OUT / f"{pid}.png", optimize=True)
    anchor = [int(v) for v in opts["anchor"].split(",")] if opts.get("anchor") else \
        meta.get("anchor") if "keep-anchor" in opts else [int(round(left)) + 1, fh]
    side_data = {k: v for k, v in meta.items() if k not in ("anchor",)}
    side_data.update({"height": height, "frames": frames, "anchor": anchor})
    if opts.get("desc"):
        side_data["desc"] = opts["desc"]
    if frames > 1:
        side_data["frameW"] = fw
        side_data["fps"] = int(opts.get("fps", meta.get("fps", 8)))
    if "footprint" in opts:
        if opts["footprint"] in ("none", "null", ""):
            side_data["footprint"] = None
        else:
            x, y, w, h = (int(v) for v in opts["footprint"].split(","))
            side_data["footprint"] = {"x": x, "y": y, "w": w, "h": h}
    if "sway" in opts:
        side_data["sway"] = opts["sway"] not in ("0", "false")
    if opts.get("light"):
        r, c, *fl = opts["light"].split(",")
        side_data["light"] = {"radius": int(r), "color": c, **({"flicker": True} if fl else {})}
    save_json(side, side_data)
    prev = PREVIEW / "art/props"
    prev.mkdir(parents=True, exist_ok=True)
    bg = checker(strip.size, step=4)
    bg.alpha_composite(strip)
    bg.resize((strip.width * 4, strip.height * 4), Image.Resampling.NEAREST).save(prev / f"{pid}.png")
    print(f"OK   {rel(OUT / f'{pid}.png')} {strip.size} anchor={anchor}")


def main(argv: list[str]) -> int:
    args, opts = parse_args(argv)
    if not args:
        print(__doc__)
        return 2
    if args[0] == "build":
        ids = args[1:] or [p.stem for p in OUT.glob("*.json") if (RAW / f"{p.stem}.png").is_file()]
        for pid in ids:
            build(pid, opts)
    elif args[0] == "gen":
        for pid in args[1:]:
            gen(pid, opts)
    else:
        for pid in args:
            if gen(pid, opts) and "suffix" not in opts:
                build(pid, opts)
    import build_manifest
    build_manifest.main([])
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

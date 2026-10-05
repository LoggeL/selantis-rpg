#!/usr/bin/env python3
"""Map backgrounds and plates (cutscenes).

Usage
  python3 scripts/art/backgrounds.py bg    <id> --desc="…" [--size=640x360|1280x720] [--refs=a.png,b.png] [--extra=…] [--suffix=-v2]
  python3 scripts/art/backgrounds.py plate <id> --desc="…" [--chars=lia,kyra] [--refs=…]
  python3 scripts/art/backgrounds.py build-bg    <id> [--size=1280x720] [--focus=0.5] [--colors=192 (0 = truecolour)]
  python3 scripts/art/backgrounds.py build-plate <id> [--focus=0.5] [--max-kb=400]
  (bg/plate = generate + build; add --gen-only to skip the build)
Raw:    output/imagegen/raw/art/bg/<id>[suffix].png, output/imagegen/raw/art/cut/<id>[suffix].png
Output: game/public/assets/bg/<id>.png (opaque 640×360 or 1280×720), game/public/assets/cut/<id>.jpg (1280×720, ≤400 KB)
Plates with characters attach the characters' reference sheets (docs/rebuild/art/refs/<id>.png) — never film frames.
Build settings are remembered in docs/rebuild/art/backgrounds.json ("builds").
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prompts as P  # noqa: E402
from gen import parse_args, run_jobs  # noqa: E402
from lib import ASSETS, DOCS_ART, RAW_ROOT, crop_16_9, load_json, rel, save_json  # noqa: E402

RAW_BG = RAW_ROOT / "art/bg"
RAW_CUT = RAW_ROOT / "art/cut"
REG = DOCS_ART / "backgrounds.json"


def remember(kind: str, bid: str, settings: dict) -> dict:
    reg = load_json(REG, {"area": "backgrounds", "images": {}})
    b = reg.setdefault("builds", {}).setdefault(f"{kind}:{bid}", {})
    b.update({k: v for k, v in settings.items() if v is not None})
    save_json(REG, reg)
    return b


def gen(kind: str, bid: str, opts: dict) -> bool:
    desc = opts.get("desc")
    if not desc:
        raise SystemExit("--desc fehlt")
    refs = [Path(r) for r in opts["refs"].split(",")] if opts.get("refs") else []
    if kind == "bg":
        refs = refs or list(P.LANDSCAPE_REFS)
        prompt = P.background_prompt(desc, opts.get("extra", ""))
        target = RAW_BG / f"{bid}{opts.get('suffix', '')}.png"
        remember("bg", bid, {"desc": desc, "size": opts.get("size")})
    else:
        for c in filter(None, opts.get("chars", "").split(",")):
            ref = DOCS_ART / f"refs/{c}.png"
            if not ref.is_file():
                raise SystemExit(f"Referenzbogen fehlt: {rel(ref)}")
            refs.append(ref)
        refs = refs or [P.LANDSCAPE_REFS[0]]
        prompt = P.plate_prompt(desc, opts.get("extra", ""))
        target = RAW_CUT / f"{bid}{opts.get('suffix', '')}.png"
        remember("plate", bid, {"desc": desc, "chars": opts.get("chars")})
    return run_jobs([{"target": target, "prompt": prompt, "refs": refs, "kind": kind, "id": bid}],
                    opts.get("area", "backgrounds"), 1)


def build_bg(bid: str, opts: dict) -> None:
    b = remember("bg", bid, {"size": opts.get("size"), "focus": opts.get("focus"), "colors": opts.get("colors")})
    w, h = (int(v) for v in str(b.get("size") or "640x360").split("x"))
    src = RAW_BG / f"{bid}.png"
    im = crop_16_9(Image.open(src).convert("RGB"), float(b.get("focus") or 0.5))
    im = im.resize((w, h), Image.Resampling.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1, percent=50, threshold=2))
    colors = 192 if b.get("colors") in (None, "") else int(b["colors"])  # palette PNG (≈ half the bytes, invisible at this pixel density); 0 = truecolour
    if colors:
        im = im.quantize(colors=min(colors, 256), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    dest = ASSETS / f"bg/{bid}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, optimize=True)
    print(f"OK   {rel(dest)} {im.size} {dest.stat().st_size // 1024} KB")


def build_plate(bid: str, opts: dict) -> None:
    b = remember("plate", bid, {"focus": opts.get("focus"), "maxKb": opts.get("max-kb")})
    src = RAW_CUT / f"{bid}.png"
    im = crop_16_9(Image.open(src).convert("RGB"), float(b.get("focus") or 0.5)).resize((1280, 720), Image.Resampling.LANCZOS)
    limit = int(b.get("maxKb") or 400) * 1024
    for q in range(90, 40, -4):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True, progressive=True, subsampling=0 if q >= 80 else 2)
        if buf.tell() <= limit:
            break
    dest = ASSETS / f"cut/{bid}.jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(buf.getvalue())
    print(f"OK   {rel(dest)} q={q} {len(buf.getvalue()) // 1024} KB")


def main(argv: list[str]) -> int:
    args, opts = parse_args(argv)
    if len(args) < 2:
        print(__doc__)
        return 2
    kind, ids = args[0], args[1:]
    for bid in ids:
        if kind in ("bg", "plate"):
            ok = gen(kind, bid, opts)
            if ok and "gen-only" not in opts and "suffix" not in opts:
                (build_bg if kind == "bg" else build_plate)(bid, opts)
        elif kind == "build-bg":
            build_bg(bid, opts)
        elif kind == "build-plate":
            build_plate(bid, opts)
        else:
            raise SystemExit(f"unbekannt: {kind}")
    import build_manifest
    build_manifest.main([])
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

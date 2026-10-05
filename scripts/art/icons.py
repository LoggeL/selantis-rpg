#!/usr/bin/env python3
"""Item icons: Codex icon sheets on magenta → single 32×32 icons → atlas game/public/assets/ui/items.png.

Usage
  python3 scripts/art/icons.py gen <sheet> --items="book:an old leather-bound book with brass corners; dagger:…" [--cols=4]
  python3 scripts/art/icons.py build [sheet …]      # cut sheets into docs/rebuild/art/icons/<id>.png, rebuild atlas
  python3 scripts/art/icons.py atlas                # only rebuild the atlas from docs/rebuild/art/icons/*.png
Sheets (ids, descriptions, grid) are registered in docs/rebuild/art/icons.json ("sheets"), so builds are reproducible.
Raw: output/imagegen/raw/art/icons/<sheet>[suffix].png. Atlas: 8 columns of 32×32 cells + ui/items.json {cell, ids}.
To replace one icon, generate a new sheet containing it; the later sheet wins (order of "sheets").
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prompts as P  # noqa: E402
from gen import parse_args, run_jobs  # noqa: E402
from lib import (ASSETS, DOCS_ART, PREVIEW, RAW_ROOT, apply_palette, check_alpha, darken_outline,  # noqa: E402
                 grid_figures, key_out, load_json, make_palette, rel, save_json, scale_to, sharpen)

RAW = RAW_ROOT / "art/icons"
SINGLE = DOCS_ART / "icons"
REG = DOCS_ART / "icons.json"
CELL = 32
COLS = 8


def reg() -> dict:
    return load_json(REG, {"area": "icons", "sheets": {}, "images": {}})


def gen(sheet: str, opts: dict) -> bool:
    pairs = [p.split(":", 1) for p in opts.get("items", "").split(";") if ":" in p]
    if not pairs:
        r = reg()["sheets"].get(sheet)
        if not r:
            raise SystemExit("--items fehlt")
        pairs = [[i, d] for i, d in zip(r["ids"], r["descs"])]
    ids = [i.strip() for i, _ in pairs]
    descs = [d.strip() for _, d in pairs]
    cols = int(opts.get("cols", min(4, len(ids))))
    rows = math.ceil(len(ids) / cols)
    data = reg()
    data["sheets"][sheet] = {"ids": ids, "descs": descs, "cols": cols, "rows": rows}
    save_json(REG, data)
    job = {"target": RAW / f"{sheet}{opts.get('suffix', '')}.png", "prompt": P.icons_prompt(descs, cols, rows, opts.get("extra", "")),
           "refs": [P.SPRITE_REFS[0]], "kind": "icons", "id": sheet}
    return run_jobs([job], "icons", 1)


def build_sheet(sheet: str) -> list[str]:
    r = reg()["sheets"][sheet]
    keyed = key_out(Image.open(RAW / f"{sheet}.png"), min_area=60)
    grid = grid_figures(keyed, r["rows"], r["cols"], min_area=200) if len(r["ids"]) == r["rows"] * r["cols"] else None
    if grid is None:
        raise SystemExit(f"{sheet}: Raster muss voll sein ({r['rows']}×{r['cols']} = {len(r['ids'])} Symbole)")
    SINGLE.mkdir(parents=True, exist_ok=True)
    cells = [c for row in grid for c in row]
    out = []
    for iid, cell in zip(r["ids"], cells):
        s = min(30 / cell.width, 30 / cell.height)
        small = darken_outline(sharpen(scale_to(cell, s), 60), 0.55)
        small = apply_palette(small, make_palette([small], colors=24, base=18))
        icon = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
        icon.alpha_composite(small, ((CELL - small.width) // 2, (CELL - small.height) // 2))
        check_alpha(icon, iid)
        icon.save(SINGLE / f"{iid}.png")
        out.append(iid)
    print(f"OK   {sheet}: {', '.join(out)}")
    return out


def atlas() -> None:
    order: list[str] = []
    for r in reg()["sheets"].values():
        for i in r["ids"]:
            if i not in order and (SINGLE / f"{i}.png").is_file():
                order.append(i)
    if not order:
        print("keine Symbole")
        return
    rows = math.ceil(len(order) / COLS)
    img = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    for k, i in enumerate(order):
        img.alpha_composite(Image.open(SINGLE / f"{i}.png").convert("RGBA"), ((k % COLS) * CELL, (k // COLS) * CELL))
    dest = ASSETS / "ui/items.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, optimize=True)
    save_json(ASSETS / "ui/items.json", {"cell": CELL, "ids": order})
    prev = PREVIEW / "art"
    prev.mkdir(parents=True, exist_ok=True)
    bg = Image.new("RGBA", img.size, (40, 46, 60, 255))
    bg.alpha_composite(img)
    bg.resize((img.width * 4, img.height * 4), Image.Resampling.NEAREST).save(prev / "icons-atlas.png")
    print(f"OK   {rel(dest)} {len(order)} Symbole")


def main(argv: list[str]) -> int:
    args, opts = parse_args(argv)
    if not args:
        print(__doc__)
        return 2
    if args[0] == "gen":
        ok = all(gen(s, opts) for s in args[1:])
        if ok and "gen-only" not in opts and "suffix" not in opts:
            for s in args[1:]:
                build_sheet(s)
            atlas()
    elif args[0] == "build":
        for s in args[1:] or list(reg()["sheets"]):
            if (RAW / f"{s}.png").is_file():
                build_sheet(s)
        atlas()
    elif args[0] == "atlas":
        atlas()
    import build_manifest
    build_manifest.main([])
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

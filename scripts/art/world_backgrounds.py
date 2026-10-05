#!/usr/bin/env python3
"""Welt-Testhintergründe (dev-world): Prompts, Erzeugung über Codex und Verarbeitung.

  python3 scripts/art/world_backgrounds.py prompt <job>     → druckt den Prompt
  python3 scripts/art/world_backgrounds.py refs <job>       → Referenzbilder (eine Zeile je Pfad)
  python3 scripts/art/world_backgrounds.py gen <job> [vN]   → erzeugt output/imagegen/raw/world/<job>[-vN].png
  python3 scripts/art/world_backgrounds.py build            → baut game/public/assets/bg/<job>.png aus SOURCES
                                                              und schreibt docs/rebuild/art/world.json

Verarbeitung wie InselRPG/Selantis: 16:9-Mittenzuschnitt, Lanczos auf Zielgröße, leichtes Nachschärfen,
Palettenreduktion (Median-Cut, ohne Dithering).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "output/imagegen/raw/world"
REFS = ROOT / "output/imagegen/style-refs"
PUBLIC = ROOT / "game/public/assets/bg"
DOC = ROOT / "docs/rebuild/art/world.json"

STYLE = (
    "High-quality 16-bit pixel art like a modern SNES-inspired fantasy adventure RPG (match the pixel-art style, detail "
    "density and rendering of the attached reference images), crisp visible square pixels, clean dark outlines, limited "
    "warm palette, soft natural light, rich painterly pixel shading, three-quarter top-down view. Selantis palette: rich "
    "summer green, wheat gold, warm wood brown, brick red, stone grey, evening orange, night blue-violet. "
    "No text, no letters, no numbers, no signs with writing, no logo, no watermark, no border, no frame, no UI."
)

MAP = (
    "Wide 16:9 landscape game map background for a 2D adventure RPG, seen from a high three-quarter top-down oblique "
    "camera (about 45 degrees, the same perspective as the attached map references: ground plane seen from above, fronts "
    "of objects facing the viewer/south). Completely EMPTY scene: absolutely no people, no characters, no figures, no "
    "animals. Large connected open walkable ground areas kept free of clutter. "
)

JOBS: dict[str, dict] = {
    "dev-meadow": {
        "size": (1280, 720),
        "refs": ["selantis-map-felder.png", "selantis-map-hof.png", "insel-bg-dorf.png"],
        "prompt": MAP + (
            "Scale: this is a LARGE scrolling map, the camera is far away; a standing adult human would be only about one "
            "sixteenth of the image height, a farmhouse door about one eleventh of the image height. "
            "Scene: a late-summer meadow on a quiet farm, dry golden-green grass after days without rain. "
            "LEFT-CENTRE: one big, old, broad deciduous tree (a lone oak) with a thick gnarled trunk and a wide round dense "
            "crown; the trunk stands on open grass with free ground all around it, the crown is about one third of the image "
            "height across. "
            "A trodden light-brown dirt footpath enters at the bottom edge slightly left of centre, curves past the tree "
            "on its right side, continues to the right and leaves the image at the right edge at about two thirds height. "
            "TOP-LEFT and along the top edge: the edge of a golden wheat field (tall wheat rows), with a clear field "
            "border to the meadow. "
            "TOP-RIGHT corner: the corner of a small half-timbered farmhouse with a red brick-tile roof and a wooden door "
            "facing south, a little wooden bench beside it, packed earth yard in front of it; the house is cut off by the "
            "top and right image edges. "
            "BOTTOM-LEFT: a small round pond with reeds and lily pads, surrounded by grass. "
            "CENTRE-RIGHT: a dense green hedge row running horizontally from the middle to the right side below the farmhouse, "
            "with a clear gap where the path passes through it. "
            "Some scattered wild flowers (cornflowers, poppies), a few small bushes at the edges, a fallen log. "
            "Warm late-afternoon sunlight from the upper left, long soft shadows to the lower right. " + STYLE
        ),
    },
    "dev-clearing": {
        "size": (640, 360),
        "refs": ["selantis-first-camp.png", "selantis-rain-forest.png", "insel-bg-lager.png"],
        "prompt": MAP + (
            "Scale: a standing adult human would be about one eighth of the image height. "
            "Scene: a small forest clearing at NIGHT. Dense dark pine and oak forest frames all four edges with large tree "
            "crowns overhanging the top edge and big tree trunks at the left and right edges. In the CENTRE of the clearing "
            "a large open area of mossy grass and bare earth. Slightly left of centre a ring of stones around a fire pit with "
            "a few unlit logs and ash (the fire is NOT burning, only faint glowing embers). A fallen tree trunk lying "
            "horizontally above the fire pit as a seat. A narrow dirt path leaves the clearing at the BOTTOM edge near the "
            "centre and another one at the RIGHT edge at middle height. Clumps of ferns and dense bushes along the left and "
            "lower right border. A flat mossy boulder on the right side of the clearing. "
            "Night mood: deep blue-violet moonlight from the upper left, cool shadows, the ground still clearly readable, "
            "small warm orange ember glow only at the fire pit. " + STYLE
        ),
    },
}

# Ziel → gewähltes Rohbild (Variante) und Farbanzahl
SOURCES: dict[str, tuple[str, int]] = {
    "dev-meadow": ("dev-meadow.png", 96),
    "dev-clearing": ("dev-clearing.png", 80),
}


def refs(job: str) -> list[Path]:
    return [REFS / r for r in JOBS[job]["refs"]]


def gen(job: str, variant: str | None) -> int:
    name = f"{job}-{variant}.png" if variant else f"{job}.png"
    target = RAW / name
    cmd = [str(ROOT / "scripts/art/codex_image.sh"), str(target), JOBS[job]["prompt"], *map(str, refs(job))]
    for attempt in range(3):
        try:
            r = subprocess.run(cmd, stdin=subprocess.DEVNULL, timeout=420)
            if r.returncode == 0 and target.exists():
                print(target)
                return 0
        except subprocess.TimeoutExpired:
            print(f"timeout (attempt {attempt + 1})", file=sys.stderr)
    return 1


def fit(src: Path, size: tuple[int, int], colors: int):
    from PIL import Image, ImageFilter

    w, h = size
    im = Image.open(src).convert("RGB")
    if im.width * h > im.height * w:
        nw = round(im.height * w / h)
        x0 = (im.width - nw) // 2
        im = im.crop((x0, 0, x0 + nw, im.height))
    else:
        nh = round(im.width * h / w)
        y0 = (im.height - nh) // 2
        im = im.crop((0, y0, im.width, y0 + nh))
    im = im.resize((w, h), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=40, threshold=2))
    im = im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)  # Palettenbild (klein)
    return im


def build() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    DOC.parent.mkdir(parents=True, exist_ok=True)
    entries = []
    for job, (raw, colors) in SOURCES.items():
        src = RAW / raw
        if not src.exists():
            print(f"fehlt: {src}", file=sys.stderr)
            continue
        out = PUBLIC / f"{job}.png"
        fit(src, JOBS[job]["size"], colors).save(out, optimize=True)
        print(out)
        entries.append({
            "id": job,
            "kind": "background",
            "prompt": JOBS[job]["prompt"],
            "refs": [str(p.relative_to(ROOT)) for p in refs(job)],
            "raw": str(src.relative_to(ROOT)),
            "output": str(out.relative_to(ROOT)),
            "size": list(JOBS[job]["size"]),
            "colors": colors,
            "tool": "scripts/art/codex_image.sh (Codex CLI image generation)",
        })
    DOC.write_text(json.dumps({"area": "world", "assets": entries}, ensure_ascii=False, indent=2) + "\n")
    print(DOC)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "prompt":
        print(JOBS[sys.argv[2]]["prompt"])
    elif cmd == "refs":
        print("\n".join(map(str, refs(sys.argv[2]))))
    elif cmd == "gen":
        sys.exit(gen(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
    elif cmd == "build":
        build()
    else:
        print(__doc__)
        sys.exit(2)

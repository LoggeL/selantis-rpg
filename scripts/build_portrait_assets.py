#!/usr/bin/env python3
"""Preserve source-art face detail in 192px portraits, without recoloring or smoothing.

Coordinates for cinematic crops use the familiar 640x360 composition and are
mapped to the original 1672x941 image before cropping. Originals stay intact.
Run this after other asset builders, which may stage legacy 48px portraits.
Lia and Kyra are prepared separately from their original book-character art;
never restore their superseded film-reference face crops during a rebuild.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'game/public/assets/portraits'
SIZE = 192

PORTRAITS = {
    'valentus': ('output/imagegen/raw/por-valentus/por-valentus.png', (330, 0, 1030, 700)),
    'valentus-wounded': ('output/imagegen/raw/por-valentus/por-valentus-wounded.png', (330, 0, 1030, 700)),
    'woman': ('output/imagegen/raw/por-woman/por-woman.png', (270, 70, 1080, 880)),
    'boy': ('output/imagegen/raw/por-boy/por-boy.png', (150, 0, 1100, 950)),
}
CINEMATIC = {
    'foltan': ('output/imagegen/story-closeups/camp-companions.png', (280, 16, 445, 181)),
    'azar': ('output/imagegen/story-closeups/camp-companions.png', (458, 28, 610, 180)),
    'father': ('output/imagegen/pixel-cinematics/raid-confrontation-head-safe-raw.png', (183, 151, 252, 220)),
    'mother': ('output/imagegen/pixel-cinematics/raid-confrontation-head-safe-raw.png', (245, 167, 321, 243)),
    'grey-haired': ('output/imagegen/pixel-cinematics/raid-confrontation-head-safe-raw.png', (363, 59, 439, 135)),
}


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (source, box) in {**PORTRAITS, **CINEMATIC}.items():
        image = Image.open(ROOT / source).convert('RGB')
        if name in CINEMATIC:
            box = tuple(round(value * image.width / 640) for value in box)
        image.crop(box).resize((SIZE, SIZE), Image.Resampling.NEAREST).save(OUT / f'{name}.png')
    # All six Lia/Kyra profiles use one reproducible novel-character source set.
    # On public-only checkouts the delivered PNGs remain intact without raw art.
    if (ROOT / 'output/imagegen/raw/novel-portraits/lia-emotions.png').exists() and (ROOT / 'output/imagegen/raw/novel-portraits/kyra.png').exists():
        from prepare_novel_portraits import build as build_novel_portraits
        build_novel_portraits()


if __name__ == '__main__':
    build()

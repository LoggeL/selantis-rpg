#!/usr/bin/env python3
"""Fit generated lance-only art into the raid actor cell, retaining the source."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / 'output/imagegen/raw/pixel-unification-story/raid-spearman.png'
TARGET = ROOT / 'game/public/assets/sprites/raid-spearman.png'


def normalize(source: Path, target: Path = TARGET):
    original = Image.open(source).convert('RGBA')
    original.putalpha(original.getchannel('A').point(lambda a: 255 if a > 110 else 0))
    source_box = original.getchannel('A').getbbox()
    if not source_box:
        raise ValueError('Generated spearman has no opaque pixels')
    if original.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Generated spearman must have a transparent background')
    # Crop the whole alpha silhouette, including the weapon rather than just
    # the body. One uniform scale retains the lance and human proportions.
    silhouette = original.crop(source_box)
    scale = min(58 / silhouette.height, 54 / silhouette.width)
    size = (max(1, round(silhouette.width * scale)), max(1, round(silhouette.height * scale)))
    small = silhouette.resize(size, Image.Resampling.NEAREST)
    frame = Image.new('RGBA', (64, 64))
    position = ((64 - size[0]) // 2, 60 - size[1])
    frame.alpha_composite(small, position)
    bounds = frame.getchannel('A').getbbox()
    if not bounds or bounds[0] < 2 or bounds[1] < 2 or bounds[2] > 62 or bounds[3] > 62:
        raise ValueError('Spearman exceeds its cell or transparent margins')
    target.parent.mkdir(parents=True, exist_ok=True)
    frame.save(target)
    receipt = {
        'source': str(source), 'sourceSize': list(original.size), 'sourceAlphaBounds': list(source_box),
        'output': str(target), 'frameSize': [64, 64], 'frame': 0,
        'scale': scale, 'footBaseline': 60, 'alphaBounds': list(bounds),
        'contract': 'One generated human and one lance; no drawn replacements or extra weapon overlays',
    }
    source.with_suffix('.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--target', type=Path, default=TARGET)
    args = parser.parse_args()
    print(normalize(args.source, args.target))

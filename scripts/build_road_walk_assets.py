#!/usr/bin/env python3
"""Normalize generated two-pose wagon/troupe art without manufacturing a step."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / 'output/imagegen/raw/pixel-unification-story/road-travelers-walk.png'
TARGET = ROOT / 'game/public/assets/sprites/road-travelers-walk.png'


def normalize(source: Path, target: Path = TARGET):
    image = Image.open(source).convert('RGBA')
    cells = []
    for i in range(4):
        cell = image.crop((round(i * image.width / 4), 0, round((i + 1) * image.width / 4), image.height))
        cell.putalpha(cell.getchannel('A').point(lambda a: 255 if a > 110 else 0))
        if not cell.getbbox():
            raise ValueError(f'Generated walking frame {i} is empty')
        cells.append(cell)
    sheet = Image.new('RGBA', (512, 64))
    receipt = []
    for indices, height in [([0, 1], 47), ([2, 3], 40)]:
        # One shared source box and scale per actor keeps its body anchored when
        # the authored feet change position between the two genuine step poses.
        boxes = [cells[i].getbbox() for i in indices]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        scale = min(height / (box[3] - box[1]), 112 / (box[2] - box[0]))
        size = (round((box[2] - box[0]) * scale), round((box[3] - box[1]) * scale))
        at = ((128 - size[0]) // 2, 60 - size[1])
        if at[0] < 1 or at[1] < 1:
            raise ValueError('Generated walking pose does not fit its transparent gutter')
        poses = []
        for index in indices:
            pose = cells[index].crop(box).resize(size, Image.Resampling.NEAREST)
            poses.append(pose)
            sheet.alpha_composite(pose, (index * 128 + at[0], at[1]))
            receipt.append({'frame': index, 'bounds': [at[0], at[1], at[0] + size[0], 60], 'source': str(source)})
        if poses[0].tobytes() == poses[1].tobytes():
            raise ValueError('Generated walking frames are identical; a real second pose is required')
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target)
    receipt_path = source.with_suffix('.receipt.json')
    receipt_path.write_text(json.dumps({'output': str(target), 'frameSize': [128, 64], 'frames': receipt}, indent=2) + '\n')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--target', type=Path, default=TARGET)
    args = parser.parse_args()
    print(normalize(args.source, args.target))

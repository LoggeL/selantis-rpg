#!/usr/bin/env python3
"""Normalize the generated Lia camp poses to the runtime pixel contract."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/imagegen/raw/lia-camp-sit/lia-camp-sit-source.png'
TARGET = ROOT / 'game/public/assets/sprites/lia-camp-sit.png'
RECEIPT = ROOT / 'design/assets/lia-camp-sit.json'


def normalize():
    original = Image.open(SOURCE).convert('RGBA')
    original.putalpha(original.getchannel('A').point(lambda a: 255 if a > 110 else 0))
    figures = []
    source_bounds = []
    for index in range(4):
        cell = original.crop((round(index * original.width / 4), 0,
                              round((index + 1) * original.width / 4), original.height))
        bounds = cell.getchannel('A').getbbox()
        if bounds is None:
            raise ValueError(f'Empty camp pose {index}')
        figures.append(cell.crop(bounds))
        source_bounds.append(list(bounds))
    scale = 37 / max(figure.height for figure in figures)
    sheet = Image.new('RGBA', (256, 64))
    frame_bounds = []
    for index, figure in enumerate(figures):
        size = (max(1, round(figure.width * scale)), max(1, round(figure.height * scale)))
        figure = figure.resize(size, Image.Resampling.NEAREST)
        sheet.alpha_composite(figure, (index * 64 + 32 - size[0] // 2, 60 - size[1]))
        cell = sheet.crop((index * 64, 0, (index + 1) * 64, 64))
        bounds = cell.getchannel('A').getbbox()
        if not bounds or bounds[0] < 2 or bounds[2] > 62 or bounds[1] < 2 or bounds[3] != 60:
            raise ValueError(f'Camp pose {index} violates cell gutters or foot baseline: {bounds}')
        frame_bounds.append(list(bounds))
    if {value for value, count in enumerate(sheet.getchannel('A').histogram()) if count} != {0, 255}:
        raise ValueError('Runtime alpha must be binary')
    sheet.save(TARGET)
    receipt = json.loads(RECEIPT.read_text())
    receipt.update({
        'sourceSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'outputSHA256': hashlib.sha256(TARGET.read_bytes()).hexdigest(),
        'sourceSize': list(original.size), 'sourceCellAlphaBounds': source_bounds,
        'outputSize': list(sheet.size), 'frameAlphaBounds': frame_bounds,
        'scale': scale, 'alphaThreshold': 110, 'alphaValues': [0, 255],
        'footYMax': 59, 'foot': [32, 60], 'frameSize': [64, 64], 'cols': 4, 'rows': 1,
        'normalization': 'Binary alpha threshold 110, equal source cells, shared anatomy scale, nearest neighbor, transparent gutters, foot bottom edge 60. No repainting.',
    })
    RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(TARGET), 'frameAlphaBounds': frame_bounds,
                      'alphaValues': [0, 255], 'outputSHA256': receipt['outputSHA256']}))


if __name__ == '__main__':
    normalize()

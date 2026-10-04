#!/usr/bin/env python3
"""Reproduce Lia travel motion from imagegen pixels; crop, scale, palette only."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median

from PIL import Image
from build_lia_novel_walk import extract
from build_pixel_unification_story import apply_palette

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/lia-travel-motion.json'
RAW = ROOT / 'output/imagegen/raw/novel-characters'


def strip(direction):
    image = Image.open(RAW / f'lia-travel-motion-{direction}.png').convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda a: 255 if a > 110 else 0))
    result = []
    for i in range(4):
        cell = image.crop((round(i * image.width / 4), 0,
                           round((i + 1) * image.width / 4), image.height))
        box = cell.getchannel('A').getbbox()
        if not box:
            raise ValueError(f'Empty {direction} frame {i}')
        result.append(cell.crop(box))
    return result


def normalize_row(cells):
    scale = 37 / median(cell.height for cell in cells)
    frames = []
    for cell in cells:
        small = cell.resize((round(cell.width * scale), round(cell.height * scale)), Image.Resampling.NEAREST)
        small = small.crop(small.getchannel('A').getbbox())
        # Keep the head still horizontally while the two feet move below it.
        # The old lowest-3-row anchor sees only the planted contact shoe.
        alpha = small.getchannel('A')
        centers = []
        for row in range(round(small.height * .1), max(round(small.height * .1) + 1, round(small.height * .22))):
            bounds = alpha.crop((0, row, small.width, row + 1)).getbbox()
            if bounds:
                centers.append((bounds[0] + bounds[2] - 1) / 2)
        center = median(centers)
        x, y = round(32 - center), 60 - small.height
        if x < 1 or y < 1 or x + small.width > 63:
            raise ValueError('Travel frame spills into 64px cell gutter')
        frame = Image.new('RGBA', (64, 64))
        frame.alpha_composite(small, (x, y))
        frames.append(frame)
    return frames


def main():
    spec = json.loads(SPEC.read_text())
    original, boundaries = extract({'name': 'travel-motion-side-source',
        'raw': 'output/imagegen/raw/novel-characters/lia-travel-motion-atlas.png'})
    rows = [strip('south'), original[4:8], original[8:12], strip('north')]
    frames = [frame for row in rows for frame in normalize_row(row)]
    palette = Image.new('P', (1, 1))
    colors = spec['normalization']['paletteRGB']
    colors += [colors[0]] * (256 - len(colors))
    palette.putpalette([value for color in colors for value in color])
    frames = [apply_palette(frame, palette) for frame in frames]
    sheet = Image.new('RGBA', (256, 256))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i % 4 * 64, i // 4 * 64))
    destination = ROOT / spec['file']
    sheet.save(destination, optimize=True)
    sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(RAW / 'lia-travel-motion-preview.png')
    receipt = {'file': spec['file'], 'fileSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'size': list(sheet.size), 'sideRawRowBoundaries': boundaries,
        'sources': [{'raw': item['raw'], 'sha256': hashlib.sha256((ROOT / item['raw']).read_bytes()).hexdigest()}
                    for item in spec['generation'] if 'raw' in item],
        'frames': [{'index': i, 'direction': spec['directions'][i // 4],
                    'phase': spec['frames'][i % 4],
                    'alphaBounds': list(frame.getchannel('A').getbbox())}
                   for i, frame in enumerate(frames)],
        'visualQA': spec['visualQA']}
    (RAW / 'lia-travel-motion-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'file': spec['file'], 'sha256': receipt['fileSha256'], 'frames': len(frames)}))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Normalize four generated directional Lia cloak strips. No authored pixels."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median

from PIL import Image

from build_pixel_unification_story import apply_palette

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/lia-cloak-motion.json'
RAW = ROOT / 'output/imagegen/raw/novel-characters'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    spec = json.loads(SPEC.read_text())
    cells = []
    for asset in spec['assets']:
        source = Image.open(ROOT / asset['raw']).convert('RGBA')
        source.putalpha(source.getchannel('A').point(lambda a: 255 if a > 110 else 0))
        for col in range(4):
            cell = source.crop((round(col * source.width / 4), 0,
                                round((col + 1) * source.width / 4), source.height))
            box = cell.getchannel('A').getbbox()
            if not box:
                raise ValueError(f'Missing sprite {asset["direction"]}:{col}')
            cells.append(cell.crop(box))

    colors = json.loads((ROOT / spec['normalization']['palette']).read_text())
    palette = Image.new('P', (1, 1))
    full = colors + [colors[0]] * (256 - len(colors))
    palette.putpalette([channel for rgb in full for channel in rgb])
    scale = 37 / median(cell.height for cell in cells)
    frames, report = [], []
    for index, cell in enumerate(cells):
        small = cell.resize((round(cell.width * scale), round(cell.height * scale)),
                            Image.Resampling.NEAREST)
        small = small.crop(small.getchannel('A').getbbox())
        alpha = small.getchannel('A')
        centers = []
        for y in range(round(small.height * .10), round(small.height * .22) + 1):
            xs = [x for x in range(small.width) if alpha.getpixel((x, y))]
            if xs:
                centers.append((min(xs) + max(xs)) / 2)
        head_center = median(centers)
        x, y = round(32 - head_center), 60 - small.height
        if min(x, y) < 1 or x + small.width > 63:
            raise ValueError(f'Frame spills into gutter: {index}')
        frame = Image.new('RGBA', (64, 64))
        frame.alpha_composite(small, (x, y))
        frame = apply_palette(frame, palette)
        frames.append(frame)
        report.append({'index': index, 'direction': spec['directions'][index // 4],
                       'phase': spec['columns'][index % 4],
                       'alphaBounds': list(frame.getchannel('A').getbbox()),
                       'headCenter': round(head_center + x, 2),
                       'contactSoleY': 60,
                       'frameSha256': hashlib.sha256(frame.tobytes()).hexdigest()})
    sheet = Image.new('RGBA', (256, 256))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((i % 4) * 64, (i // 4) * 64))
    destination = ROOT / spec['file']
    sheet.save(destination, optimize=True)
    sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(RAW / 'lia-cloak-motion-preview.png')
    # Animated proof shows real foot motion at the consumed 37px scale.
    animated = []
    for col in range(4):
        proof = Image.new('RGBA', (256, 64), (24, 28, 27, 255))
        for row in range(4):
            proof.alpha_composite(frames[row * 4 + col], (row * 64, 0))
        animated.append(proof.resize((1024, 256), Image.Resampling.NEAREST).convert('RGB'))
    animated[0].save(RAW / 'lia-cloak-motion-directions.gif', save_all=True,
                     append_images=animated[1:], duration=150, loop=0, disposal=2)
    receipt = {'file': spec['file'], 'fileSha256': sha(destination),
               'size': [256, 256], 'paletteColors': len(colors),
               'paletteSha256': sha(ROOT / spec['normalization']['palette']),
               'sources': [{'raw': a['raw'], 'sha256': sha(ROOT / a['raw'])}
                           for a in spec['assets']], 'frames': report,
               'visualReview': spec['visualReview']}
    (RAW / 'lia-cloak-motion-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'file': spec['file'], 'sha256': receipt['fileSha256'], 'size': sheet.size}))


if __name__ == '__main__':
    main()

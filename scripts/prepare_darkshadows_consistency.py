#!/usr/bin/env python3
"""Prepare accepted Imagegen edits without changing original runtime dimensions."""
import json
import hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/darkshadows-consistency.json'


def main():
    spec = json.loads(SPEC.read_text())
    delivery = []
    for entry in spec['portraits'] + spec.get('cuts', []):
        target = ROOT / entry['asset']
        source = ROOT / entry['source']
        with Image.open(target) as old:
            size = old.size
        with Image.open(source) as generated:
            # Fixed aspect/size only. Creative edits originate exclusively in Imagegen.
            source_size = generated.size
            image = generated.convert('RGB').resize(size, Image.Resampling.LANCZOS)
            image.save(target, optimize=True)
        delivery.append({'asset': entry['asset'], 'path': entry['asset'], 'source': entry['source'], 'sourcePath': entry['source'], 'size': list(size), 'width': size[0], 'height': size[1], 'sourceSize': list(source_size), 'processing': 'RGB conversion and PNG reencode; original dimensions' if source_size == size else 'RGB conversion, Lanczos resize to original runtime dimensions, PNG reencode', 'byteExact': False})
    if spec.get('sprite'):
        entry = spec['sprite']
        target = ROOT / entry['asset']
        # Read the latest shared atlas and preserve every cell outside owned frame 2.
        atlas = Image.open(target).convert('RGBA')
        def cell_hashes(sheet):
            return [hashlib.sha256(sheet.crop(((i % 4)*64, (i // 4)*64, (i % 4 + 1)*64, (i // 4 + 1)*64)).tobytes()).hexdigest() for i in range(8)]
        before = cell_hashes(atlas)
        generated = Image.open(ROOT / entry['source']).convert('RGBA')
        generated.putalpha(generated.getchannel('A').point(lambda x: 255 if x >= 110 else 0))
        bounds = generated.getchannel('A').getbbox()
        sprite = generated.crop(bounds)
        width = round(sprite.width * 42 / sprite.height)
        sprite = sprite.resize((width, 42), Image.Resampling.NEAREST)
        cell = Image.new('RGBA', (64, 64))
        cell.alpha_composite(sprite, ((64-width)//2, 18))
        assert set(cell.getchannel('A').tobytes()).issubset({0, 255})
        assert cell.getchannel('A').getbbox()[3] == 60
        cell.save(ROOT / 'output/imagegen/raw/darkshadows-consistency/grey-haired-frame2.png')
        atlas.paste(cell, (128, 0))
        after = cell_hashes(atlas)
        assert all(before[i] == after[i] for i in range(8) if i != 2)
        atlas.save(target, optimize=True)
        delivery.append({'asset': entry['asset'], 'path': entry['asset'], 'frame': 2, 'scope': 'frame2 only; whole atlas SHA is a delivery snapshot and changes when other owners update their cells', 'source': entry['source'], 'sourcePath': entry['source'], 'width': atlas.width, 'height': atlas.height, 'cell': [64, 64], 'frameSha256': after[2], 'processing': 'RGBA binary alpha threshold110 before crop, nearest resize to42px figure, foot32,60 and transparent gutter; replace frame2 only', 'byteExact': False, 'unownedCellHashesBefore': before, 'unownedCellHashesAfter': after})
    for entry in delivery:
        entry['sha256'] = hashlib.sha256((ROOT / entry['asset']).read_bytes()).hexdigest()
        entry['sourceSha256'] = hashlib.sha256((ROOT / entry['source']).read_bytes()).hexdigest()
    path = ROOT / 'design/assets/darkshadows-consistency-delivery.json'
    path.write_text(json.dumps({'preparation': 'RGB, original runtime dimensions, Lanczos resize', 'assets': delivery}, indent=2) + '\n')
    print(f'Prepared {len(delivery)} assets')


if __name__ == '__main__':
    main()

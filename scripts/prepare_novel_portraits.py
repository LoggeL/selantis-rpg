#!/usr/bin/env python3
"""Crop generated book-character portraits without repainting their source art.

Run after legacy asset builders. The Lia emotion sheet consists of three
equal square panels; compact portraits use a 48px pixel grid at 192px storage.
Private raw generation files are preserved, and the delivery metadata records
their exact crops and hashes. No palette or creative image edits are applied.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'output/imagegen/raw/novel-portraits'
OUT = ROOT / 'game/public/assets/portraits'
META = ROOT / 'design/assets/lia-kyra-novel-portraits.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    lia_path = RAW / 'lia-emotions.png'
    kyra_path = RAW / 'kyra.png'
    lia = Image.open(lia_path).convert('RGB')
    kyra = Image.open(kyra_path).convert('RGB')
    assert lia.width == 3 * lia.height, 'Three equal square Lia panels required'
    assert kyra.width == kyra.height, 'Square Kyra portrait required'
    size = lia.height
    entries = []
    for index, name in enumerate(['dialogue-lia', 'dialogue-lia-grief', 'dialogue-lia-determined']):
        box = (index * size, 0, (index + 1) * size, size)
        path = OUT / f'{name}.png'
        lia.crop(box).resize((1254, 1254), Image.Resampling.NEAREST).save(path)
        entries.append({'path': str(path.relative_to(ROOT)), 'source': str(lia_path.relative_to(ROOT)),
                        'sourceSha256': digest(lia_path), 'crop': list(box),
                        'width': 1254, 'height': 1254, 'sha256': digest(path)})
    path = OUT / 'dialogue-kyra.png'
    kyra.resize((1254, 1254), Image.Resampling.NEAREST).save(path)
    entries.append({'path': str(path.relative_to(ROOT)), 'source': str(kyra_path.relative_to(ROOT)),
                    'sourceSha256': digest(kyra_path), 'crop': [0, 0, kyra.width, kyra.height],
                    'width': 1254, 'height': 1254, 'sha256': digest(path)})
    for name, source, image, fractions in [
        ('lia', lia_path, lia.crop((0, 0, size, size)), (0.20, 0.025, 0.80, 0.625)),
        ('kyra', kyra_path, kyra, (0.20, 0.015, 0.80, 0.615)),
    ]:
        box = tuple(round(value * image.width) for value in fractions)
        compact = image.crop(box).resize((48, 48), Image.Resampling.NEAREST)
        path = OUT / f'{name}.png'
        compact.resize((192, 192), Image.Resampling.NEAREST).save(path)
        entries.append({'path': str(path.relative_to(ROOT)), 'source': str(source.relative_to(ROOT)),
                        'sourceSha256': digest(source), 'crop': list(box),
                        'pixelGrid': 48, 'width': 192, 'height': 192, 'sha256': digest(path)})
    metadata = {
        'intent': 'Book descriptions take precedence over film-actor likenesses for Lia and Kyra.',
        'characters': {
            'lia': {'hair': 'Long strawberry-blonde curls loosely pinned at the back',
                    'clothes': 'White gathered round-neck peasant blouse without collar or button placket, brown skirt',
                    'eyeColor': 'Unspecified in checked novel description; drawn naturally without canon claim',
                    'expressions': ['neutral', 'grief', 'determined']},
            'kyra': {'hair': 'Long nut-brown hair', 'eyes': 'Brown',
                     'clothes': 'Workworn dirt-stained beige dress with short rough sleeves'},
        },
        'tool': 'image_gen.imagegen', 'mode': 'built-in',
        'identityReferences': ['game/public/assets/cut/lia-kyra.png', 'game/public/assets/cut/kyra-wood.png'],
        'style': 'Natural teenage facial proportions and small almond-shaped eyes matching final story illustrations',
        'receipts': str((RAW / 'generation-receipts.json').relative_to(ROOT)),
        'preparation': 'scripts/prepare_novel_portraits.py; crop and nearest-neighbor scaling only',
        'deliveries': entries,
    }
    META.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'portraits': len(entries), 'metadata': str(META.relative_to(ROOT))}))


if __name__ == '__main__':
    build()

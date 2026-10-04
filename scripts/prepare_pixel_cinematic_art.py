"""Stage approved cinematic sources unchanged; 640x360 is the scene coordinate space.

No crop, resize, palette reduction or re-encoding is applied. Optional wound
layers remain derived engine effects with the original source geometry.
"""
from pathlib import Path
import argparse
import json
from PIL import Image, ImageOps
from cinematic_asset_delivery import copy_approved_source, delivery_record, image_record

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/public/assets/cut'

def prepare(source: Path, destination: Path, alpha=False):
    return copy_approved_source(source, destination, alpha)


def record(source: Path, destination: Path):
    metadata = delivery_record(source, destination, ROOT)
    spec_path = ROOT / 'design/assets/pixel-cinematic-art.json'
    spec = json.loads(spec_path.read_text())
    spec['verifiedOutputs'] = [entry for entry in spec.get('verifiedOutputs', []) if entry['path'] != metadata['path']] + [metadata]
    for asset in spec['assets']:
        if asset['path'] == metadata['path']:
            asset['finalRaw'] = metadata['sourcePath']
    spec_path.write_text(json.dumps(spec, indent=2) + '\n')

def wound_layers(im):
    ImageOps.grayscale(im).convert('RGB').save(OUT / 'wound-mono.png', optimize=True)
    red = im.convert('RGBA')
    red.putalpha(Image.new('L', im.size, 255))
    red.save(OUT / 'wound-red.png', optimize=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('name')
    parser.add_argument('--alpha', action='store_true')
    parser.add_argument('--wound-layers', action='store_true')
    args = parser.parse_args()
    result = prepare(args.source, OUT / args.name, args.alpha)
    record(args.source, OUT / args.name)
    if args.wound_layers:
        wound_layers(result)
        spec_path = ROOT / 'design/assets/pixel-cinematic-art.json'
        spec = json.loads(spec_path.read_text())
        for layer in spec['derivedLayers']:
            path = OUT / f"{layer['name']}.png"
            layer['delivery'] = {'path': str(path.relative_to(ROOT)), **image_record(path),
                                 'sourcePath': str((OUT / args.name).relative_to(ROOT))}
        spec_path.write_text(json.dumps(spec, indent=2) + '\n')

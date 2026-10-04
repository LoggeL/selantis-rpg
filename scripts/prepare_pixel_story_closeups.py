"""Deliver approved story closeups at their original resolution and encoding.

Run from repository root after placing full-size source PNGs in the ignored
output/imagegen/story-closeups directory. No cropping, quantization, scaling
or palette computation is applied; all source composition stays intact.
"""
from pathlib import Path
import json
from cinematic_asset_delivery import copy_approved_source, delivery_record

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/pixel-story-closeups.json'
SOURCE = ROOT / 'output/imagegen/story-closeups'
DEST = ROOT / 'game/public/assets/cut'

def main():
    spec = json.loads(SPEC.read_text())
    assets = spec['assets']
    DEST.mkdir(parents=True, exist_ok=True)
    for asset in assets:
        source = SOURCE / asset['file']
        destination = DEST / asset['file']
        copy_approved_source(source, destination)
        asset['delivery'] = delivery_record(source, destination, ROOT)
        asset.pop('normalizationCropTopSourcePixels', None)
        print(f"{asset['file']}: {asset['delivery']['width']}x{asset['delivery']['height']}, {destination.stat().st_size} bytes")
    spec['normalization'] = 'Byte-exact approved source passthrough. No crop, resize, quantization, palette reduction or re-encoding.'
    spec['frame'] = {'sceneCoordinateSpace': [640, 360],
                     'sourceSizes': [list(size) for size in sorted({(asset['delivery']['width'], asset['delivery']['height']) for asset in assets})],
                     'preparation': 'preserve full approved source', 'aspectRatioTolerancePixels': 1}
    spec.pop('sharedPaletteRgb', None)
    SPEC.write_text(json.dumps(spec, indent=2) + '\n')

if __name__ == '__main__':
    main()

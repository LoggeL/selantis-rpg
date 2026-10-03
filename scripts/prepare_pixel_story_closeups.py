"""Normalize generated story closeups without drawing substitute artwork.

Run from repository root after placing full-size source PNGs in the ignored
output/imagegen/story-closeups directory. A shared palette is recomputed from
all delivered sources; source images themselves remain unchanged.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/pixel-story-closeups.json'
SOURCE = ROOT / 'output/imagegen/story-closeups'
DEST = ROOT / 'game/public/assets/cut'

def main():
    spec = json.loads(SPEC.read_text())
    assets = spec['assets']
    bases = []
    for asset in assets:
        source = Image.open(SOURCE / asset['file']).convert('RGB')
        # Optional crop moves hands above captions without drawing or recoloring.
        top = asset.get('normalizationCropTopSourcePixels', 0)
        if top:
            source = source.crop((0, top, source.width, source.height))
        bases.append(ImageOps.fit(source, (320, 180), method=Image.Resampling.NEAREST))
    swatch = Image.new('RGB', (320, 180 * len(bases)))
    for index, base in enumerate(bases):
        swatch.paste(base, (0, 180 * index))
    palette = swatch.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    DEST.mkdir(parents=True, exist_ok=True)
    for asset, base in zip(assets, bases):
        normalized = base.quantize(palette=palette, dither=Image.Dither.NONE).resize((640, 360), Image.Resampling.NEAREST)
        destination = DEST / asset['file']
        normalized.save(destination, optimize=True)
        asset['delivery'] = {'path': str(destination.relative_to(ROOT)), 'width':640, 'height':360, 'bytes':destination.stat().st_size, 'paletteColors':len(normalized.getcolors() or []), 'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(), 'sourceSha256':hashlib.sha256((SOURCE / asset['file']).read_bytes()).hexdigest()}
        print(f"{asset['file']}: 640x360, {destination.stat().st_size} bytes")
    spec['sharedPaletteRgb'] = [palette.getpalette()[i:i+3] for i in range(0, 192, 3)]
    SPEC.write_text(json.dumps(spec, indent=2) + '\n')

if __name__ == '__main__':
    main()

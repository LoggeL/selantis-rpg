"""Stage the generated sister close-up on the existing 2x pixel grid/palette."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/lia-kyra.json'

def main():
    spec = json.loads(SPEC.read_text())
    source = ROOT / spec['source']
    base = ImageOps.fit(Image.open(source).convert('RGB'), (320, 180), method=Image.Resampling.NEAREST)
    colors = json.loads((ROOT / 'design/assets/pixel-story-closeups.json').read_text())['sharedPaletteRgb']
    palette = Image.new('P', (1, 1))
    palette.putpalette([channel for color in colors for channel in color])
    delivered = base.quantize(palette=palette, dither=Image.Dither.NONE).resize((640, 360), Image.Resampling.NEAREST)
    destination = ROOT / spec['delivery']['file']
    delivered.save(destination, optimize=True)
    spec['delivery'].update(bytes=destination.stat().st_size, sha256=hashlib.sha256(destination.read_bytes()).hexdigest())
    spec['sourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    SPEC.write_text(json.dumps(spec, indent=2) + '\n')
    print(json.dumps(spec['delivery']))

if __name__ == '__main__':
    main()

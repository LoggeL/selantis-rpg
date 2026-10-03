"""Check shipped PNG contracts without requiring private generated source files.

Requires Pillow. This checks file integrity and pixel placement, not visual
identity or narrative accuracy; those still require a browser/art review.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'game/public'


def main():
    manifest = json.loads((PUBLIC / 'assets/manifest.json').read_text())
    checked = set()
    frames = 0
    for key, sheet in manifest['sprites'].items():
        path = PUBLIC / sheet['file']
        with Image.open(path) as image:
            assert image.size == (sheet['frameW'] * sheet['cols'], sheet['frameH'] * sheet['rows']), key
            if key.startswith('crt-') or key == 'story-items':
                continue
            rgba = image.convert('RGBA')
            assert {color for _, color in rgba.getchannel('A').getcolors(256)} <= {0, 255}, key
            for index in range(sheet['cols'] * sheet['rows']):
                x, y = index % sheet['cols'] * sheet['frameW'], index // sheet['cols'] * sheet['frameH']
                cell = rgba.crop((x, y, x + sheet['frameW'], y + sheet['frameH']))
                box = cell.getchannel('A').getbbox()
                if box is None:
                    continue  # Unused contract slots may be transparent.
                assert 0 < box[0] and box[2] < sheet['frameW'], (key, index, 'edge clipping')
                assert 0 < box[1] and box[3] == sheet['foot'][1], (key, index, 'foot anchor')
                frames += 1
        checked.add(path)
    for key, filename in manifest['images'].items():
        path = PUBLIC / filename
        with Image.open(path) as image:
            image.load()  # Decode every registered image, including backgrounds.
            if '/portraits/' in filename:
                assert image.size == (48, 48), key
                checked.add(path)
            elif '/cut/' in filename:
                assert image.size == (640, 360), key
                logical = image.resize((320, 180), Image.Resampling.NEAREST)
                assert image.tobytes() == logical.resize((640, 360), Image.Resampling.NEAREST).tobytes(), (key, 'pixel grid')
                checked.add(path)
    print(json.dumps({'pixelFiles': len(checked), 'occupiedFrames': frames,
                      'bytes': sum(path.stat().st_size for path in checked),
                      'manifestImagesDecoded': len(manifest['images'])}))


if __name__ == '__main__':
    main()

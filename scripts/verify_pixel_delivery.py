"""Check shipped PNG contracts without requiring private generated source files.

Requires Pillow. This checks file integrity and pixel placement, not visual
identity or narrative accuracy; those still require a browser/art review.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'game/public'


def main():
    manifest = json.loads((PUBLIC / 'assets/manifest.json').read_text())
    cinematic = json.loads((ROOT / 'design/assets/pixel-cinematic-art.json').read_text())
    story = json.loads((ROOT / 'design/assets/pixel-story-closeups.json').read_text())
    sisters = json.loads((ROOT / 'design/assets/lia-kyra.json').read_text())
    records = {entry['path']: entry for entry in cinematic['verifiedOutputs']}
    records.update({asset['delivery']['path']: asset['delivery'] for asset in story['assets']})
    records[sisters['delivery']['file']] = sisters['delivery']
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
                assert image.width == image.height and image.width >= 96, (key, 'portrait detail')
                checked.add(path)
            elif '/cut/' in filename:
                assert abs(image.height - image.width * 9 / 16) <= 1, (key, 'source composition')
                assert image.width >= 640 and image.height >= 360, (key, 'cut resolution')
                record = records.get(str(path.relative_to(ROOT)))
                if record:
                    assert image.size == (record['width'], record['height']), (key, 'source resolution')
                    digest = hashlib.sha256(path.read_bytes()).hexdigest()
                    assert digest == record['sha256'] == record['sourceSha256'], (key, 'approved source hash')
                    source = ROOT / record['sourcePath']
                    if source.exists():
                        assert digest == hashlib.sha256(source.read_bytes()).hexdigest(), (key, 'source changed')
                checked.add(path)
    # Dedicated dialogue profiles use the shared loader rather than the manifest.
    for path in (PUBLIC / 'assets/portraits').glob('*.png'):
        with Image.open(path) as image:
            image.load()
            assert image.width == image.height and image.width >= 96, (path.name, 'portrait detail')
        checked.add(path)
    print(json.dumps({'pixelFiles': len(checked), 'occupiedFrames': frames,
                      'bytes': sum(path.stat().st_size for path in checked),
                      'manifestImagesDecoded': len(manifest['images']), 'sourceDeliveriesVerified': len(records)}))


if __name__ == '__main__':
    main()

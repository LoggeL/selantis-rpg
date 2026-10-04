#!/usr/bin/env python3
"""Stage approved Imagegen camp cutouts and nearest-neighbor runtime sprites.

This is production normalization, not repainting: generated pixels and alpha
remain unchanged before the documented integer-coordinate crop and nearest
sampling. The >=128 alpha mask finds visual bounds only; it never replaces alpha.
"""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/camp-detailed-spec.json'
RAW = ROOT / 'output/imagegen/raw/camp-detailed'
OUT = ROOT / 'game/public/assets/props'
QA = ROOT / 'output/qa/camp-detailed'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    spec = json.loads(SPEC.read_text())
    for folder in [RAW, OUT, QA]:
        folder.mkdir(parents=True, exist_ok=True)
    entries = []
    normalized = {}
    for asset in spec['assets']:
        source = Path(asset['sourcePath'])
        staged = RAW / (asset['id'] + '.png')
        if source.exists():
            shutil.copyfile(source, staged)
        source_image = Image.open(staged).convert('RGBA')
        alpha = source_image.getchannel('A')
        bounds = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
        assert bounds, staged
        crop = (max(0, bounds[0]-8), max(0, bounds[1]-8), min(source_image.width, bounds[2]+8), min(source_image.height, bounds[3]+8))
        content = source_image.crop(crop)
        width = asset['renderWidth']
        height = max(1, round(content.height * width / content.width))
        content = content.resize((width, height), Image.Resampling.NEAREST)
        canvas = Image.new('RGBA', (width+2, height+2))
        canvas.paste(content, (1, 1))
        destination = OUT / (asset['key'] + '.png')
        canvas.save(destination)
        assert all(canvas.getpixel(point)[3] == 0 for point in [(0,0),(canvas.width-1,0),(0,canvas.height-1),(canvas.width-1,canvas.height-1)])
        normalized[asset['key']] = canvas
        entries.append({'key': asset['key'], 'file': str(destination.relative_to(ROOT)), 'size': list(canvas.size), 'source': str(staged.relative_to(ROOT)), 'sourceSize': list(source_image.size), 'sourceSha256':digest(staged), 'sha256':digest(destination), 'crop':list(crop), 'normalization':'nearest-neighbor; generated alpha preserved; one transparent padding pixel', 'alphaExtrema':list(canvas.getchannel('A').getextrema())})
    manifest_path = ROOT / 'game/public/assets/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    for entry in entries:
        manifest['images'][entry['key']] = entry['file'].removeprefix('game/public/')
    manifest['images']['bg-companion-forest-trail'] = 'assets/bg/companion-forest-trail.png'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    (ROOT/'design/assets/camp-detailed-delivery.json').write_text(json.dumps({'generator':spec['generator'],'references':spec['referenceImages'],'assets':entries},indent=2)+'\n')
    sheet = Image.new('RGBA', (900, 480), '#212b34')
    draw = ImageDraw.Draw(sheet)
    for i,entry in enumerate(entries):
        image = normalized[entry['key']]
        x,y = (i % 4)*225, (i//4)*240
        draw.text((x+10,y+10),entry['key'],fill='#eedcc2')
        draw.text((x+10,y+28),f"{image.width}x{image.height}",fill='#aaacae')
        large = image.resize((image.width*3,image.height*3), Image.Resampling.NEAREST)
        sheet.alpha_composite(large,(x+(225-large.width)//2,y+65))
    sheet.convert('RGB').save(QA/'contact-sheet.png')
    for time in ['evening','night']:
        bg = Image.open(ROOT/f'game/public/assets/bg/first-camp-{time}-unbuilt.png').convert('RGBA')
        positions = {'camp-cloak-detailed':(233,260),'camp-stones-detailed':(155,235),'camp-twigs-detailed':(409,251),'camp-fire-ring-detailed':(317,225),'camp-logs-detailed':(317,225)}
        for key,(x,y) in positions.items():
            im=normalized[key]; bg.alpha_composite(im,(x-im.width//2,y-im.height//2))
        fire=normalized['camp-fire-detailed']; bg.alpha_composite(fire,(317-fire.width//2,225-fire.height))
        bg.convert('RGB').resize((1280,720),Image.Resampling.NEAREST).save(QA/f'objects-{time}.png')
    print(json.dumps(entries, indent=2))

if __name__ == '__main__':
    main()

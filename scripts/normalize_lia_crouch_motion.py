#!/usr/bin/env python3
"""Normalize reviewed imagegen crouch gait frames, touching no other sprite."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/lia-crouch-motion.json'


def source_frame(raw, source):
    image = Image.open(raw / source['file']).convert('RGBA')
    cols, rows, i = source['cols'], source['rows'], source['index']
    x, y = i % cols, i // cols
    image = image.crop((round(x * image.width / cols), round(y * image.height / rows), round((x + 1) * image.width / cols), round((y + 1) * image.height / rows)))
    image.putalpha(image.getchannel('A').point(lambda a: 255 if a > 110 else 0))
    box = image.getchannel('A').getbbox()
    if box is None:
        raise ValueError(source)
    return image.crop(box)


def main():
    spec = json.loads(SPEC.read_text())
    raw = ROOT / spec['rawRoot']
    destination = ROOT / spec['runtime']['file']
    frames = []
    for row in spec['rows']:
        for source in row['frames']:
            sprite = source_frame(raw, source)
            # Individually generated correction canvases have different raw
            # scale, but all represent the same 24px deep crouch anatomy.
            width = round(sprite.width * 24 / sprite.height)
            sprite = sprite.resize((width, 24), Image.Resampling.NEAREST)
            sprite = sprite.crop(sprite.getchannel('A').getbbox())
            frame = Image.new('RGBA', (64, 64))
            frame.alpha_composite(sprite, (round(32 - sprite.width / 2), 60 - sprite.height))
            frames.append(frame)
    colors = [p[:3] for frame in frames for p in frame.get_flattened_data() if p[3]]
    pixels = Image.new('RGB', (len(colors), 1))
    pixels.putdata(colors)
    palette = pixels.quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    sheet = Image.new('RGBA', (256, 256))
    for i, frame in enumerate(frames):
        alpha = frame.getchannel('A')
        frame = frame.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
        frame.putalpha(alpha)
        frames[i] = frame
        sheet.paste(frame, (i % 4 * 64, i // 4 * 64))
    sheet.save(destination, optimize=True)
    preview = Image.new('RGB', (1024, 1024), '#262b32')
    preview.paste(sheet.resize((1024, 1024), Image.Resampling.NEAREST), (0, 0), sheet.resize((1024, 1024), Image.Resampling.NEAREST))
    draw = ImageDraw.Draw(preview)
    for row, label in enumerate(['South left / pass / right / pass', 'West near front / pass / near back / pass', 'East near front / pass / near back / pass', 'North left / pass / right / pass']):
        draw.text((8, row * 256 + 8), label, fill='white')
    preview.save(raw / 'contact-runtime.png')
    animation = []
    for phase in range(4):
        im = Image.new('RGB', (1024, 256), '#262b32')
        for row in range(4):
            sprite = frames[row * 4 + phase].resize((256, 256), Image.Resampling.NEAREST)
            im.paste(sprite, (row * 256, 0), sprite)
        animation.append(im)
    animation[0].save(raw / 'crouch-walk-animation.gif', save_all=True, append_images=animation[1:], duration=200, loop=0, disposal=2)
    report = {'file': spec['runtime']['file'], 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'size': sheet.size, 'frameBounds': [frame.getchannel('A').getbbox() for frame in frames], 'alphaValues': sorted(set(sheet.getchannel('A').get_flattened_data())), 'contact': str((raw / 'contact-runtime.png').relative_to(ROOT)), 'animation': str((raw / 'crouch-walk-animation.gif').relative_to(ROOT))}
    (raw / 'normalization-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

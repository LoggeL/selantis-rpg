#!/usr/bin/env python3
"""Normalize generated novel Lia actions; merge only assigned story actor cells."""
from pathlib import Path
from statistics import median
import hashlib
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'design/assets/lia-novel-actions.json'
RAW = ROOT / 'output/imagegen/raw/novel-characters/actions'


def extract(asset):
    image = Image.open(RAW / asset['raw']).convert('RGBA')
    data = np.array(image)
    opaque = data[:, :, 3] > 110
    labels, count = ndimage.label(opaque, structure=np.ones((3, 3)))
    slices = ndimage.find_objects(labels)
    masks = [np.zeros(opaque.shape, dtype=bool) for _ in range(asset['cols'] * asset['rows'])]
    # Assign connected silhouettes to cells before cropping. The sleeping cloak
    # extends slightly across the invisible source cell edge and must stay whole.
    for label, box in enumerate(slices, 1):
        if box is None:
            continue
        piece = labels[box] == label
        if piece.sum() < 16:
            continue
        ys, xs = box
        x = min(asset['cols'] - 1, int((xs.start + xs.stop) / 2 * asset['cols'] / image.width))
        y = min(asset['rows'] - 1, int((ys.start + ys.stop) / 2 * asset['rows'] / image.height))
        masks[y * asset['cols'] + x][box] |= piece
    cells = []
    for mask in masks:
        result = image.copy()
        result.putalpha(Image.fromarray(np.where(mask, 255, 0).astype(np.uint8)))
        box = result.getchannel('A').getbbox()
        if box is None:
            raise ValueError(f"Empty frame in {asset['name']}")
        cells.append(result.crop(box))
    return cells


def foot_center(image):
    alpha = np.array(image.getchannel('A'))
    centers = []
    for row in alpha[-3:]:
        xs = np.flatnonzero(row)
        if len(xs):
            centers.append((int(xs[0]) + int(xs[-1])) / 2)
    return median(centers)


def normalize(asset):
    source = extract(asset)
    scale = 37 / median(source[i].height for i in asset['anchors'])
    frames = []
    for i, sprite in enumerate(source):
        size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
        sprite = sprite.resize(size, Image.Resampling.NEAREST)
        sprite = sprite.crop(sprite.getchannel('A').getbbox())
        # Lying/sitting sprites anchor to ground at the bottom and center by full
        # silhouette; standing/crouching sprites use the actual foot positions.
        center = sprite.width / 2 if asset['name'] == 'lia-story-poses' and i in [0, 1, 2, 3, 4, 7] else foot_center(sprite)
        x, y = round(32 - center), 60 - sprite.height
        if x < 1 or y < 1 or x + sprite.width > 63:
            raise ValueError(f"Frame spills: {asset['name']}:{i}, {sprite.size}, {(x, y)}")
        frame = Image.new('RGBA', (64, 64))
        frame.alpha_composite(sprite, (x, y))
        frames.append(frame)
    return frames, scale


def palette(frames):
    colors = [p[:3] for frame in frames for p in frame.get_flattened_data() if p[3]]
    pixels = Image.new('RGB', (len(colors), 1))
    pixels.putdata(colors)
    return pixels.quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def apply_palette(frame, colors):
    result = frame.convert('RGB').quantize(palette=colors, dither=Image.Dither.NONE).convert('RGBA')
    result.putalpha(frame.getchannel('A'))
    return result


def corrected_grief(template, colors):
    """Use reviewed no-gear correction at the original seated anatomy height."""
    path = RAW / 'grief-pose-corrected-v2-raw.png'
    if not path.exists():
        return template
    sprite = Image.open(path).convert('RGBA')
    sprite.putalpha(sprite.getchannel('A').point(lambda a: 255 if a > 110 else 0))
    sprite = sprite.crop(sprite.getchannel('A').getbbox())
    box = template.getchannel('A').getbbox()
    height = box[3] - box[1]
    width = round(sprite.width * height / sprite.height)
    sprite = sprite.resize((width, height), Image.Resampling.NEAREST)
    sprite = sprite.crop(sprite.getchannel('A').getbbox())
    frame = Image.new('RGBA', (64, 64))
    frame.alpha_composite(sprite, (round(32 - sprite.width / 2), 60 - sprite.height))
    return apply_palette(frame, colors)


def actor_cell(image, i):
    x, y = i % 4 * 64, i // 4 * 64
    return image.crop((x, y, x + 64, y + 64))


def main():
    spec = json.loads(SPEC.read_text())
    normalized = {a['name']: normalize(a) for a in spec['assets']}
    lia_frames = sum((normalized[name][0] for name in ['lia-read', 'lia-hide', 'lia-story-poses']), []) + [normalized['story-actors'][0][2]]
    lia_palette = palette(lia_frames)
    kyra_palette = palette(normalized['story-actors'][0][:2])
    reports = []
    for asset in spec['assets']:
        name = asset['name']
        frames, scale = normalized[name]
        frames = [apply_palette(f, kyra_palette if name == 'story-actors' and i < 2 else lia_palette) for i, f in enumerate(frames)]
        if name == 'lia-story-poses':
            frames[0] = corrected_grief(frames[0], lia_palette)
        destination = ROOT / f'game/public/assets/sprites/{name}.png'
        sheet = Image.open(destination).convert('RGBA') if name == 'story-actors' else Image.new('RGBA', (256, 128))
        retained = {i: actor_cell(sheet, i).tobytes() for i in range(2, 7)} if name == 'story-actors' else {}
        indices = asset.get('destinations', list(range(len(frames))))
        for i, frame in zip(indices, frames):
            # paste replaces all RGBA values in owned cell; other cells untouched.
            sheet.paste(frame, (i % 4 * 64, i // 4 * 64))
        sheet.save(destination, optimize=True)
        readback = Image.open(destination).convert('RGBA')
        assert all(actor_cell(readback, i).tobytes() == data for i, data in retained.items())
        reports.append({'name': name, 'file': str(destination.relative_to(ROOT)), 'size': sheet.size, 'sourceScale': scale, 'frameBounds': [f.getchannel('A').getbbox() for f in frames], 'retainedCells': {str(i): hashlib.sha256(data).hexdigest() for i, data in retained.items()}, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()})
    contact = Image.new('RGB', (1024, 4 * 280), '#262b32')
    draw = ImageDraw.Draw(contact)
    for row, asset in enumerate(spec['assets']):
        draw.text((12, row * 280 + 5), asset['name'], fill='white')
        im = Image.open(ROOT / f"game/public/assets/sprites/{asset['name']}.png").convert('RGBA').resize((1024, 512), Image.Resampling.NEAREST)
        # Four columns, two rows at 2x: the runtime contact keeps all eight poses
        # together while leaving enough margins to read their anatomy size.
        im = im.resize((512, 256), Image.Resampling.NEAREST)
        contact.paste(im, (256, row * 280 + 23), im)
    contact.save(RAW / 'contact-runtime.png')
    (RAW / 'normalization-report.json').write_text(json.dumps(reports, indent=2) + '\n')
    spec['status'] = 'normalized_pending_final_visual_inspection'
    spec['normalizationReport'] = 'output/imagegen/raw/novel-characters/actions/normalization-report.json'
    spec['contactSheet'] = 'output/imagegen/raw/novel-characters/actions/contact-runtime.png'
    SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()

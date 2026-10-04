#!/usr/bin/env python3
"""Normalize generated Foltan frames only: alpha, crop, size, palette, foot anchor."""
import hashlib
import json
from pathlib import Path
from statistics import median
from PIL import Image
from build_lia_novel_walk import extract
from build_pixel_unification_story import apply_palette
ROOT = Path(__file__).resolve().parents[1]

def main():
    spec = json.loads((ROOT / 'design/assets/companion-walk.json').read_text())
    for asset in spec['assets']:
        cells, boundaries = extract(asset)
        scale = asset['height'] / median(cell.height for cell in cells)
        frames = []
        for row in [0, 2, 1, 3]:
            for cell in cells[row * 4:row * 4 + 4]:
                small = cell.resize((round(cell.width * scale), asset['height']), Image.Resampling.NEAREST)
                small = small.crop(small.getchannel('A').getbbox())
                frame = Image.new('RGBA', (64, 64))
                # A planted left/right boot must not pull the whole torso sideways.
                # Keep the head/neck axis over the shared runtime ground anchor.
                head = small.getchannel('A').crop((0, 0, small.width, max(1, round(small.height / 5)))).getbbox()
                position = (round(32 - (head[0] + head[2]) / 2), 60 - small.height)
                if position[0] < 1 or position[1] < 1 or position[0] + small.width > 63:
                    raise ValueError('Frame would cross transparent gutter')
                frame.alpha_composite(small, position)
                frames.append(frame)
        colors = [pixel[:3] for frame in frames for pixel in frame.get_flattened_data() if pixel[3]]
        color_image = Image.new('RGB', (len(colors), 1)); color_image.putdata(colors)
        palette = color_image.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        frames = [apply_palette(frame, palette) for frame in frames]
        sheet = Image.new('RGBA', (256, 256))
        for i, frame in enumerate(frames): sheet.alpha_composite(frame, ((i % 4) * 64, (i // 4) * 64))
        sheet.save(ROOT / asset['file'], optimize=True)
        sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(ROOT / 'output/imagegen/raw/companion-walk/foltan-normalized-preview.png')
        receipt = {'file':asset['file'],'frameSize':[64,64],'groundAnchor':[32,60],'bodyHeight':asset['height'],'horizontalAlignment':'head and neck alpha band midpoint at x=32; planted toe does not shift torso','sourceRowBoundaries':boundaries,'sourceRowOrder':asset['sourceRows'],'runtimeRows':['south','west','east','north'],'scale':scale,'sha256':hashlib.sha256((ROOT / asset['file']).read_bytes()).hexdigest(),'frames':[{'index':i,'alphaBounds':frame.getchannel('A').getbbox(),'sha256':hashlib.sha256(frame.tobytes()).hexdigest()} for i,frame in enumerate(frames)]}
        (ROOT / 'output/imagegen/raw/companion-walk/foltan-normalization-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
        print(asset['file'], sheet.size, boundaries)
if __name__ == '__main__': main()

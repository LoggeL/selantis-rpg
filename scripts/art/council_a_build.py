#!/usr/bin/env python3
"""Deterministic cropping/build only; source boards generated with built-in ImageGen.

Does not generate images, modify cast, or write the asset manifest.
"""
import json
import shutil
from pathlib import Path
from PIL import Image
from lib import key_out, grid_figures, scale_to, band_center, place, make_palette, apply_palette, sha
from characters import finish, idle_frames
from qa import walk_previews

ROOT = Path(__file__).resolve().parents[2]
RECORD = ROOT / 'docs/rebuild/art/council-a.json'

def main():
    record = json.loads(RECORD.read_text())
    for item in record['characters']:
        cid = item['id']
        source = ROOT / item['source']
        if not source.exists():
            source.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item['generatedPath'], source)
        board = Image.open(source).convert('RGB')
        divider = item['divider']
        walk = key_out(board.crop((0, 0, divider, board.height)))
        rows = grid_figures(walk, 4, 4)
        frames = []
        for row in rows:
            # Match the explicit visible-height contract for every cell.
            for figure in row:
                small = finish(scale_to(figure, item['height'] / figure.height))
                frames.append(place(small, (64,64), band_center(small,.02,.2), (32,60),cid))
        palette = make_palette(frames, colors=44)
        frames = [apply_palette(f,palette) for f in frames]
        sheet = Image.new('RGBA',(256,256))
        for i,frame in enumerate(frames):
            sheet.alpha_composite(frame,((i%4)*64,(i//4)*64))
        sprites = ROOT / 'game/public/assets/sprites'
        sprites.mkdir(parents=True,exist_ok=True)
        sprite = sprites / f'{cid}-walk.png'
        sheet.save(sprite,optimize=True)
        metadata = {'character':cid,'height':item['height'],'foot':[32,60],'fps':8,'idle':idle_frames(frames),'dirs':['down','left','right','up'],'frameW':64,'frameH':64,'cols':4,'rows':4}
        sprite.with_suffix('.json').write_text(json.dumps(metadata,indent=2)+'\n')
        # Honest turnaround assembled from this identity's generated walk frames.
        ref = Image.new('RGBA',(3*192,256))
        for i,(r,c) in enumerate([(0,0),(2,0),(3,0)]):
            f = rows[r][c]
            f.thumbnail((176,240),Image.Resampling.NEAREST)
            ref.alpha_composite(f,(i*192+(192-f.width)//2,256-f.height))
        ref.save(ROOT / f'docs/rebuild/art/refs/{cid}.png',optimize=True)
        # Portrait panel: use full square crop around face/shoulders.
        width = board.width-divider
        portrait = board.crop((divider,0,board.width,width))
        if width >=768:
            portrait = portrait.resize((512,512),Image.Resampling.BOX)
        portrait = portrait.resize((256,256),Image.Resampling.LANCZOS)
        portrait = portrait.quantize(colors=160,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
        dest = ROOT / f'game/public/assets/portraits/{cid}.png'
        portrait.save(dest,optimize=True)
        walk_previews(cid,sheet)
        item['outputs'] = {str(sprite.relative_to(ROOT)):sha(sprite),str(dest.relative_to(ROOT)):sha(dest)}
        item['sourceSha256'] = sha(source)
        print(cid,metadata)
    RECORD.write_text(json.dumps(record,indent=2)+'\n')

if __name__ == '__main__':
    main()

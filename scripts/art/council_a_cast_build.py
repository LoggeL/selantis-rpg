#!/usr/bin/env python3
"""Build four quiet hand-raised council cast poses, without touching other assets."""
import json
import shutil
from pathlib import Path
from PIL import Image
from lib import key_out, split_columns, scale_to, band_center, place, make_palette, apply_palette, sha
from characters import finish

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/rebuild/art/refs/council-a-cast-board.png'

def main():
    if not SOURCE.exists():
        shutil.copy2('/Users/logge/.codex/generated_images/01a10c9d-a474-7b52-9ac8-8c1a85c36326/exec-121bca5d-e4c8-4df4-8a43-92c7b55f9fa3.png',SOURCE)
    figures=split_columns(key_out(Image.open(SOURCE)),4)
    path=ROOT/'docs/rebuild/art/council-a.json'
    record=json.loads(path.read_text())
    for cid,figure in zip(['ulfbert','loyla','gira','tholoss'],figures):
        height=48 if cid=='tholoss' else 43
        small=finish(scale_to(figure,height/figure.height))
        frame=place(small,(64,64),band_center(small,.02,.2),(32,60),cid+'-cast')
        walk=Image.open(ROOT/f'game/public/assets/sprites/{cid}-walk.png').convert('RGBA')
        palette=make_palette([walk,frame],colors=44)
        frame=apply_palette(frame,palette)
        dest=ROOT/f'game/public/assets/sprites/{cid}-cast.png'
        frame.save(dest,optimize=True)
        meta={'character':cid,'pose':'cast','facing':'right','foot':[32,60],'height':height,'frames':1,'fps':6}
        dest.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n')
        assert frame.getbbox()[3]==60 and frame.getbbox()[3]-frame.getbbox()[1]==height
        print(cid,frame.size,frame.getbbox())
        for item in record['characters']:
            if item['id']==cid:
                item['outputs'][str(dest.relative_to(ROOT))]=sha(dest)
    record['cast']={'method':'built-in image_gen__imagegen','source':str(SOURCE.relative_to(ROOT)),'sourceSha256':sha(SOURCE),'prompt':'Four separated full-body quiet hand-raised voting/casting poses facing right. Own identity refs ulfbert,loyla,gira,tholoss; preserve hair, faces and navy/crimson/green/ochre-slate robes. No magic effects, objects or text. Tholloss taller and gaunt. Magenta background, crisp 1990s RPG pixel art.','qa':'Raw four-character board visually inspected. Four final poses retain identities and raised hands. Exact 64x64 cells, foot32/60, heights43/43/43/48.'}
    record['qa']['remaining']='Manifest/cast integration and browser QA owned by root.'
    path.write_text(json.dumps(record,indent=2)+'\n')

if __name__=='__main__':
    main()

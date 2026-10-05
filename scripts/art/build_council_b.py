"""Build council-b combined identity sheets without touching shared cast or manifest."""
import sys
from pathlib import Path
import json
import hashlib
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import grid_figures, scale_to, place, band_center, check_alpha, sha
from characters import finish, idle_frames
from qa import walk_metrics, walk_warnings, walk_previews

ROOT = Path(__file__).resolve().parents[2]

def build(cid, portrait_box, grid_box):
    raw = ROOT / f'output/imagegen/raw/council-b/{cid}.png'
    im = Image.open(raw).convert('RGBA')
    portrait = im.crop(portrait_box).resize((256, 256), Image.Resampling.LANCZOS)
    pd = ROOT / f'game/public/assets/portraits/{cid}.png'
    portrait.save(pd)
    sprite_source = im.crop(grid_box)
    sprite_source.putalpha(sprite_source.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    if cid in ('burm','gwynn','samira','rikkon'):
        xs={'burm':[0,360,627,895,1254],'gwynn':[0,335,625,915,1254],'samira':[0,410,625,840,1254],'rikkon':[0,385,625,865,1254]}[cid]
        ys={'burm':[0,246,491,727,1000],'gwynn':[0,239,476,717,1034],'samira':[0,239,467,700,984],'rikkon':[0,257,509,756,1064]}[cid]
        grid=[]
        for r in range(4):
            row=[]
            for c in range(4):
                cell=sprite_source.crop((xs[c],ys[r],xs[c+1],ys[r+1]))
                row.append(cell.crop(cell.getchannel('A').getbbox()))
            grid.append(row)
    else:
        grid = grid_figures(sprite_source, 4, 4)
    if cid == 'burm':
        grid[1], grid[2] = grid[2], grid[1]  # Raw sheet profile rows face right then left.
    if cid in ('samira','rikkon'):
        for col in (2,3):
            grid[1][col] = grid[2][col].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    frames=[]
    for row in grid:
        for fig in row:
            small=finish(scale_to(fig,43/fig.height))
            frames.append(place(small,(64,64),band_center(small,.02,.2),(32,60),cid))
    sheet=Image.new('RGBA',(256,256))
    for i,f in enumerate(frames): sheet.alpha_composite(f,((i%4)*64,(i//4)*64))
    check_alpha(sheet,cid)
    sd=ROOT / f'game/public/assets/sprites/{cid}-walk.png'
    sheet.save(sd)
    side={'height':43,'foot':[32,60],'fps':8,'idle':idle_frames(frames),'dirs':['down','left','right','up']}
    sd.with_suffix('.json').write_text(json.dumps(side,indent=2)+'\n')
    walk_previews(cid,sheet)
    metrics=walk_metrics(sheet)
    entry={'id':cid,'generator':'built-in image_gen','raw':str(raw.relative_to(ROOT)),'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'portraitBox':portrait_box,'gridBox':grid_box,'outputs':{'portrait':str(pd.relative_to(ROOT)),'walk':str(sd.relative_to(ROOT))},'metrics':metrics,'warnings':walk_warnings(metrics)}
    (raw.parent / f'{cid}-build.json').write_text(json.dumps(entry,indent=2)+'\n')
    print(json.dumps(entry,indent=2))
    return entry

if __name__=='__main__':
    build(sys.argv[1],tuple(map(int,sys.argv[2].split(','))),tuple(map(int,sys.argv[3].split(','))))

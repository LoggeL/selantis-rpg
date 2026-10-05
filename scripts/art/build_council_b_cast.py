"""Extract the council-b vote/cast poses from the built-in generated production sheet."""
import sys
import json
import hashlib
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import grid_figures, scale_to, place, band_center, check_alpha
from characters import finish

ROOT=Path(__file__).resolve().parents[2]
IDS=['burm','gwynn','samira','rikkon']

def build():
    raw=ROOT/'output/imagegen/raw/council-b/cast.png'
    im=Image.open(raw).convert('RGBA')
    im.putalpha(im.getchannel('A').point(lambda a:255 if a>=128 else 0))
    figures=grid_figures(im,1,4)[0]
    outputs=[]
    preview=Image.new('RGBA',(256,64),(205,190,150,255))
    for i,(cid,fig) in enumerate(zip(IDS,figures)):
        small=finish(scale_to(fig,43/fig.height))
        frame=place(small,(64,64),band_center(small,.02,.2),(32,60),cid+'-cast')
        check_alpha(frame,cid+'-cast')
        dest=ROOT/f'game/public/assets/sprites/{cid}-cast.png'
        frame.save(dest)
        dest.with_suffix('.json').write_text(json.dumps({'character':cid,'pose':'cast','facing':'right','foot':[32,60],'height':43},indent=2)+'\n')
        preview.alpha_composite(frame,(i*64,0))
        outputs.append({'id':cid,'file':str(dest.relative_to(ROOT)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'visibleHeight':frame.getchannel('A').getbbox()[3]-frame.getchannel('A').getbbox()[1],'foot':[32,60],'facing':'right'})
    preview.resize((1024,256),Image.Resampling.NEAREST).save(ROOT/'output/imagegen/preview/art/council-b-cast.png')
    record=ROOT/'docs/rebuild/art/council-b.json'
    data=json.loads(record.read_text())
    data['castPoses']={'generator':'built-in image_gen','raw':str(raw.relative_to(ROOT)),'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'buildScript':'scripts/art/build_council_b_cast.py','outputs':outputs}
    record.write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps(outputs,indent=2))

if __name__=='__main__':build()

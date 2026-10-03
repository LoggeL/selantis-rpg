#!/usr/bin/env python3
"""Export newly authored prologue pixel art; never synthesizes or redraws pixels.

Only crop, nearest-neighbor resize, binary alpha, shared palette quantization,
and placement are used. Generation and targeted edits are built-in image_gen.
"""
import hashlib
import json
import base64
import re
from pathlib import Path
from statistics import median
import numpy as np
from PIL import Image, ImageColor, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / 'design/assets/pixel-unification-prologue.json'

def binary(im):
    a = np.array(im.convert('RGBA'))
    # The explicit flat chroma-key fallback is used only when source lacks alpha.
    key = (a[:, :, 0] > 160) & (a[:, :, 2] > 160) & (a[:, :, 1] < 115)
    a[key] = 0
    a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a)

def quantize(im, palette):
    alpha = im.getchannel('A')
    out = im.convert('RGB').quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(alpha)
    a = np.array(out)
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a)

def center(im, box):
    x0, y0, x1, y1 = box
    a = np.array(im.getchannel('A'))
    rows = []
    for y in range(y0 + int((y1-y0)*.2), y0 + int((y1-y0)*.65)):
        xs = np.flatnonzero(a[y] >= 128)
        if len(xs): rows.append((int(xs[0])+int(xs[-1]))/2)
    return median(rows) if rows else (x0+x1)/2

def clean_gutter(cell):
    """Discard disconnected gutter specks, retaining authored figure pixels."""
    a = np.array(cell)
    labels, _ = ndimage.label(a[:,:,3] > 0, structure=np.ones((3,3)))
    sizes = np.bincount(labels.ravel())
    if len(sizes) > 1:
        largest = max(sizes[1:])
        keep = sizes >= largest*.03
        keep[0] = False
        a[~keep[labels]] = 0
    return Image.fromarray(a)

def boundaries(raw, count, axis):
    """Use transparent authored gutters when generator spacing is nonuniform."""
    a = np.array(raw.getchannel('A'))
    gaps = np.flatnonzero((a > 0).sum(axis=1 if axis == 1 else 0) == 0)
    runs = [r for r in np.split(gaps, np.flatnonzero(np.diff(gaps)>1)+1) if len(r)>2]
    length = raw.height if axis == 1 else raw.width
    centers = [(int(r[0])+int(r[-1]))/2 for r in runs]
    out = [0]
    for i in range(1, count):
        expected = i*length/count
        nearby = [c for c in centers if abs(c-expected)<length/count*.25]
        out.append(round(min(nearby, key=lambda c:abs(c-expected))) if nearby else round(expected))
    return out+[length]

def main():
    spec = json.loads(SPEC.read_text())
    rgb = [ImageColor.getrgb(c) for c in spec['palette']]
    palette = Image.new('P', (1, 1))
    palette.putpalette([n for color in rgb + [rgb[-1]] * (256-len(rgb)) for n in color])
    preview = Image.new('RGB', (1024, 1200), '#24272b')
    draw = ImageDraw.Draw(preview)
    reports = []
    for j, job in enumerate(spec['assets']):
        source = (SPEC.parent / job['source']).resolve()
        output = (SPEC.parent / job['output']).resolve()
        raw = Image.open(source).convert('RGBA')
        if 'grid' not in job:
            result = quantize(raw.resize(tuple(job['size']), Image.Resampling.NEAREST), palette)
            result.putalpha(255)
            frames = [result]
        else:
            cols, rows = job['grid']
            raw = binary(raw)
            xs, ys = boundaries(raw, cols, 0), boundaries(raw, rows, 1)
            job['sourceBoundaries'] = {'x':xs,'y':ys}
            cells = [raw.crop((xs[c], ys[r], xs[c+1], ys[r+1]))
                     for r in range(rows) for c in range(cols)]
            cells = [clean_gutter(c) for c in cells]
            boxes = [c.getchannel('A').getbbox() for c in cells]
            scale = job['height'] / median(boxes[i][3]-boxes[i][1] for i in job['heightRefs'])
            result = Image.new('RGBA', (64*cols, 64*rows))
            frames = []
            for i, (cell, box) in enumerate(zip(cells, boxes)):
                frame = Image.new('RGBA', (64, 64))
                if i not in job.get('emptyFrames', []) and box:
                    crop = cell.crop(box)
                    size = (max(1, round(crop.width*scale)), max(1, round(crop.height*scale)))
                    if size[0] > 62 or size[1] > 58:
                        raise ValueError(f'{job["id"]} frame {i} would clip {size}')
                    small = crop.resize(size, Image.Resampling.NEAREST)
                    x = round(32-(center(cell, box)-box[0])*scale)
                    # Fixed foot contact, fully keep the rare wide gesture inside gutters.
                    x = min(63-size[0], max(1, x))
                    frame.alpha_composite(small, (x, 60-size[1]))
                frames.append(quantize(frame, palette))
                result.alpha_composite(frames[-1], ((i%cols)*64, (i//cols)*64))
        output.parent.mkdir(parents=True, exist_ok=True)
        result.save(output, optimize=True)
        a = np.array(result)
        visible = {tuple(p[:3]) for p in a.reshape(-1,4) if p[3]}
        assert visible.issubset(set(rgb))
        assert set(a[:,:,3].flatten()).issubset({0,255})
        reports.append({'id':job['id'], 'file':str(output.relative_to(ROOT)), 'bytes':output.stat().st_size,
                        'size':list(result.size), 'visibleColors':len(visible),
                        'alpha':'0/255', 'occupiedFrames':sum(f.getchannel('A').getbbox() is not None for f in frames),
                        'frameBounds':[f.getchannel('A').getbbox() for f in frames],
                        'distinctFrames':len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}),
                        'sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
        # One preview strip per asset, all frames are inspectable at exact integer zoom.
        px, py = (j%2)*512, (j//2)*150
        draw.text((px+8, py+3), job['id'], fill='#eee0c2')
        for k, frame in enumerate(frames[:16]):
            preview.paste(frame.resize((64,64), Image.Resampling.NEAREST),
                          (px+(k%8)*64, py+20+(k//8)*64), frame.resize((64,64),Image.Resampling.NEAREST))
    qa = ROOT / 'output/imagegen/pixel-unification-prologue-qa'
    qa.mkdir(parents=True, exist_ok=True)
    preview.save(qa/'contact-native.png')
    preview.resize((2048,2400), Image.Resampling.NEAREST).save(qa/'contact-2x.png')
    (qa/'report.json').write_text(json.dumps(reports, indent=2)+'\n')
    # Exact existing BootScene sequences, no animation remapping in game code.
    owned = {j['id'] for j in spec['assets'] if 'grid' in j}
    boot = (ROOT/'game/src/scenes/BootScene.ts').read_text()
    anims = []
    for match in re.finditer(r"'([^']+)': \['([^']+)', \[([^]]+)\], ([\d.]+), (true|false)\]", boot):
        name, sheet, numbers, fps, loop = match.groups()
        if sheet in owned:
            anims.append({'name':name,'sheet':sheet,'frames':[int(x.strip()) for x in numbers.split(',')], 'fps':float(fps),'loop':loop=='true'})
    for r, d in enumerate(['s','w','e','n']):
        for name, sheet, frames, fps in [('idle','valentus-walk',[0],1),('walk','valentus-walk',[0,1,2,3],8),
                ('beam','valentus-cast',[0,1],10),('wave','valentus-cast',[0,2],10),
                ('guard','valentus-cast',[3],1),('run','valentus-cloak-run',[0,1,2,3],7)]:
            prefix = 'vc' if name == 'run' else 'v'
            anims.append({'name':f'{prefix}-{name}-{d}','sheet':sheet,'frames':[r*4+n for n in frames],'fps':fps,'loop':name in ['walk','run']})
    textures = {j['id']:'data:image/png;base64,'+base64.b64encode((SPEC.parent/j['output']).read_bytes()).decode()
                for j in spec['assets'] if 'grid' in j}
    data = json.dumps({'anims':anims,'textures':textures})
    html = '''<!doctype html><meta charset="utf-8"><title>Prologue pixel animation QA</title>
    <style>body{background:#24272b;color:#eee0c2;font:13px monospace}main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}canvas{image-rendering:pixelated;width:128px;height:128px}section{border:1px solid #45474e;padding:8px}button{margin-bottom:16px}</style>
    <button id="pause">Pause</button><main></main><script>const data=DATA;let paused=false;const images={};
    for(const [id,url]of Object.entries(data.textures)){images[id]=new Image();images[id].src=url;}
    const views=data.anims.map(a=>{const s=document.createElement('section');s.append(document.createTextNode(a.name));s.append(document.createElement('br'));const c=document.createElement('canvas');c.width=c.height=64;s.append(c);document.querySelector('main').append(s);return{...a,c,ctx:c.getContext('2d')}});
    document.querySelector('button').onclick=()=>paused=!paused;let stamp=0;function tick(t){if(!paused)stamp=t;
    for(const a of views){const f=a.frames[Math.floor(stamp/1000*a.fps)%a.frames.length],im=images[a.sheet];a.ctx.clearRect(0,0,64,64);if(im.complete)a.ctx.drawImage(im,(f%4)*64,Math.floor(f/4)*64,64,64,0,0,64,64)}requestAnimationFrame(tick)}requestAnimationFrame(tick);</script>'''.replace('DATA',data)
    (qa/'animations.html').write_text(html)
    (qa/'animation-map.json').write_text(json.dumps(anims,indent=2)+'\n')
    spec['qa'] = {'exportChecks':reports, 'bytesTotal':sum(r['bytes'] for r in reports),
                  'contactSheet':'output/imagegen/pixel-unification-prologue-qa/contact-native.png',
                  'animationPreview':'output/imagegen/pixel-unification-prologue-qa/animations.html',
                  'runtimeAcceptance':'Parent task must verify native game animations and scenes.'}
    SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False)+'\n')
    print(json.dumps({'assets':len(reports), 'bytes':spec['qa']['bytesTotal'], 'report':str(qa/'report.json')}))

if __name__ == '__main__': main()

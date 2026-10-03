"""Prepare generated cinematic illustration files for the native 640x360 contract.

Source pixels are generated art. This script only crops/resizes and derives
aligned engine colour layers; it does not draw replacement artwork.
"""
from pathlib import Path
import argparse
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/public/assets/cut'

def prepare(source: Path, destination: Path, alpha=False):
    im = Image.open(source).convert('RGBA' if alpha else 'RGB')
    # Exact 16:9 centre crop, followed by the shared 320x180 pixel grid.
    w, h = im.size
    if w * 9 > h * 16:
        crop_w = h * 16 // 9
        left = (w - crop_w) // 2
        im = im.crop((left, 0, left + crop_w, h))
    elif w * 9 < h * 16:
        crop_h = w * 9 // 16
        top = (h - crop_h) // 2
        im = im.crop((0, top, w, top + crop_h))
    im = im.resize((320, 180), Image.Resampling.NEAREST)
    im = im.resize((640, 360), Image.Resampling.NEAREST)
    destination.parent.mkdir(parents=True, exist_ok=True)
    im.save(destination, optimize=True)
    return im

def wound_layers(im):
    ImageOps.grayscale(im).convert('RGB').save(OUT / 'wound-mono.png', optimize=True)
    red = im.convert('RGBA')
    red.putalpha(Image.new('L', im.size, 255))
    red.save(OUT / 'wound-red.png', optimize=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('name')
    parser.add_argument('--alpha', action='store_true')
    parser.add_argument('--wound-layers', action='store_true')
    args = parser.parse_args()
    result = prepare(args.source, OUT / args.name, args.alpha)
    if args.wound_layers:
        wound_layers(result)

#!/usr/bin/env python3
"""Normalize only generated Lia book motion poses, no authored pixels."""
import hashlib
import json
from statistics import median

from PIL import Image

from build_lia_novel_walk import ROOT, extract, normalize
from build_pixel_unification_story import apply_palette


def main_component_crop(image):
    """Crop the body component's bounds; discard only detached gutter debris."""
    alpha = image.getchannel("A")
    active = {(x, y) for y in range(image.height) for x in range(image.width) if alpha.getpixel((x, y))}
    largest = set()
    while active:
        start = active.pop()
        component, todo = {start}, [start]
        while todo:
            x, y = todo.pop()
            for dx, dy in ((-1,-1), (0,-1), (1,-1), (-1,0), (1,0), (-1,1), (0,1), (1,1)):
                p = x+dx, y+dy
                if p in active:
                    active.remove(p)
                    component.add(p)
                    todo.append(p)
        if len(component) > len(largest):
            largest = component
    xs, ys = zip(*largest)
    return image.crop((min(xs), min(ys), max(xs)+1, max(ys)+1))


def stable_normalize(cells):
    scale = 37 / median(c.height for c in cells)
    frames = []
    for cell in cells:
        small = cell.resize((max(1, round(cell.width * scale)), max(1, round(cell.height * scale))), Image.Resampling.NEAREST)
        small = small.crop(small.getchannel("A").getbbox())
        alpha = small.getchannel("A")
        head_centers = []
        for y in range(round(small.height * .10), max(round(small.height * .10) + 1, round(small.height * .22))):
            xs = [x for x in range(small.width) if alpha.getpixel((x, y))]
            if xs:
                head_centers.append((xs[0] + xs[-1]) / 2)
        x = round(32 - median(head_centers))
        y = 60 - small.height
        frame = Image.new("RGBA", (64, 64))
        frame.alpha_composite(small, (x, y))
        frames.append(frame)
    return frames


def main():
    spec = json.loads((ROOT / "design/assets/lia-book-motion.json").read_text())
    asset = {"name": "book-motion", "raw": spec["sources"]["atlas"]["raw"]}
    atlas_cells, boundaries = extract(asset)
    strip = Image.open(ROOT / spec["sources"]["south"]["raw"]).convert("RGBA")
    strip.putalpha(strip.getchannel("A").point(lambda a: 255 if a > 110 else 0))
    south = []
    for col in range(4):
        cell = strip.crop((round(col * strip.width / 4), 0, round((col + 1) * strip.width / 4), strip.height))
        south.append(cell.crop(cell.getchannel("A").getbbox()))
    rows = [south] + [atlas_cells[row * 4:(row + 1) * 4] for row in range(1, 4)]
    frames = [f for cells in rows for f in stable_normalize([main_component_crop(c) for c in cells])]
    palette = Image.new("P", (1, 1))
    colors = [tuple(c) for c in spec["normalization"]["palette"]]
    palette.putpalette([v for c in colors + [colors[-1]] * (256 - len(colors)) for v in c])
    frames = [apply_palette(f, palette) for f in frames]
    sheet = Image.new("RGBA", (256, 256))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((i % 4) * 64, (i // 4) * 64))
    destination = ROOT / spec["file"]
    sheet.save(destination, optimize=True)
    raw = ROOT / "output/imagegen/raw/novel-characters"
    sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(raw / "lia-book-motion-preview.png")
    gif = []
    for col in range(4):
        image = Image.new("RGB", (256, 256), (45, 62, 56))
        for row in range(4):
            frame = frames[row * 4 + col].resize((128, 128), Image.Resampling.NEAREST)
            image.paste(frame, ((row % 2) * 128, (row // 2) * 128), frame)
        gif.append(image)
    gif[0].save(raw / "lia-book-motion-preview.gif", save_all=True, append_images=gif[1:], duration=160, loop=0)
    receipt = {"file": spec["file"], "fileSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
               "rawRowBoundaries": boundaries,
               "sources": [{"raw": source["raw"], "sha256": hashlib.sha256((ROOT / source["raw"]).read_bytes()).hexdigest()}
                           for source in spec["sources"].values()],
               "frames": [{"index": i, "direction": ["south", "west", "east", "north"][i//4],
                           "phase": spec["phaseOrder"][i%4], "alphaBounds": list(f.getchannel("A").getbbox())}
                          for i, f in enumerate(frames)]}
    (raw / "lia-book-motion-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(destination)


if __name__ == "__main__":
    main()

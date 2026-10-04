#!/usr/bin/env python3
"""Normalize Lia's generated empty-handed farm atlas; no authored pixels."""
import hashlib
import json
from pathlib import Path
from statistics import median

from PIL import Image

from build_lia_novel_walk import ROOT, extract, normalize
from build_pixel_unification_story import apply_palette

SPEC = ROOT / "design/assets/lia-farm-walk.json"


def remove_neighbor_leaks(cell):
    """Discard tiny disconnected alpha pieces from an adjacent atlas cell."""
    occupied = {(x, y) for y in range(cell.height) for x in range(cell.width)
                if cell.getpixel((x, y))[3]}
    components = []
    while occupied:
        start = occupied.pop()
        component, pending = {start}, [start]
        while pending:
            x, y = pending.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    point = (x + dx, y + dy)
                    if point in occupied:
                        occupied.remove(point)
                        component.add(point)
                        pending.append(point)
        components.append(component)
    threshold = max(map(len, components)) * 0.05
    result = cell.copy()
    for component in components:
        if len(component) < threshold:
            for point in component:
                result.putpixel(point, (0, 0, 0, 0))
    return result.crop(result.getchannel("A").getbbox())


def main():
    spec = json.loads(SPEC.read_text())
    asset = spec["assets"][0]
    cells, boundaries = extract(asset)
    cells = [remove_neighbor_leaks(cell) for cell in cells]
    frames = normalize(cells)
    # Re-anchor horizontally to the head, not the advancing front foot.
    # The generated face silhouette remains stable while the shoes alternate.
    anchored_frames = []
    for frame in frames:
        bounds = frame.getchannel("A").getbbox()
        height = bounds[3] - bounds[1]
        centers = []
        for y in range(bounds[1] + round(height * 0.10), bounds[1] + round(height * 0.22)):
            xs = [x for x in range(64) if frame.getpixel((x, y))[3]]
            if xs:
                centers.append((min(xs) + max(xs)) / 2)
        shift = round(32 - median(centers))
        anchored = Image.new("RGBA", (64, 64))
        anchored.alpha_composite(frame, (shift, 0))
        anchored_frames.append(anchored)
    frames = anchored_frames
    # Use the same palette source and order as the existing three Lia atlases.
    wardrobe = json.loads((ROOT / "design/assets/lia-novel-walk.json").read_text())
    wardrobe_frames = [f for item in wardrobe["assets"]
                       for f in normalize(extract(item)[0])]
    colors = [p[:3] for f in wardrobe_frames for p in f.get_flattened_data() if p[3]]
    palette_source = Image.new("RGB", (len(colors), 1))
    palette_source.putdata(colors)
    palette = palette_source.quantize(colors=32, method=Image.Quantize.MEDIANCUT,
                                    dither=Image.Dither.NONE)
    frames = [apply_palette(f, palette) for f in frames]
    sheet = Image.new("RGBA", (256, 256))
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((i % 4) * 64, (i // 4) * 64))
    destination = ROOT / asset["file"]
    sheet.save(destination, optimize=True)
    raw_directory = (ROOT / asset["raw"]).parent
    sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(raw_directory / "lia-farm-walk-preview.png")
    animation = []
    for phase in range(4):
        contact = Image.new("RGBA", (128, 128), (44, 57, 51, 255))
        for direction in range(4):
            contact.alpha_composite(frames[direction * 4 + phase],
                                    (direction % 2 * 64, direction // 2 * 64))
        animation.append(contact.resize((512, 512), Image.Resampling.NEAREST).convert("RGB"))
    animation[0].save(raw_directory / "lia-farm-walk-motion.gif", save_all=True,
                      append_images=animation[1:], duration=140, loop=0, disposal=2)
    receipt = {
        "name": asset["name"], "file": asset["file"], "size": [256, 256],
        "rawRowBoundaries": boundaries,
        "rawSha256": hashlib.sha256((ROOT / asset["raw"]).read_bytes()).hexdigest(),
        "fileSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "scriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "specSha256": hashlib.sha256(SPEC.read_bytes()).hexdigest(),
        "paletteSourceSha256": {item["raw"]: hashlib.sha256((ROOT / item["raw"]).read_bytes()).hexdigest()
                                for item in wardrobe["assets"]},
        "visualMotionQA": {
            "southNorth": "alternating left and right forward feet with separate passing frames",
            "westEast": "visible wide stride and feet-close passing movement; anatomical opposite-leg identity in contact frames 1/3 remains ambiguous",
            "horizontalAnchor": "head silhouette center sampled at 10-22 percent body height, never foremost foot",
            "gif": "output/imagegen/raw/novel-characters/lia-farm-walk-motion.gif"
        },
        "frames": [{"index": i, "direction": spec["directions"][i // 4],
                    "alphaBounds": list(f.getchannel("A").getbbox()),
                    "opaqueColors": len({p[:3] for p in f.get_flattened_data() if p[3]})}
                   for i, f in enumerate(frames)]
    }
    (raw_directory / "lia-farm-walk-normalization-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(destination)


if __name__ == "__main__":
    main()

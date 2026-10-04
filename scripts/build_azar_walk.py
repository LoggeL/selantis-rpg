#!/usr/bin/env python3
"""Normalize the generated Azar walk sheet without authoring character pixels.

Only alpha cleanup, row extraction, nearest-neighbor resizing, and ground/head
anchoring are applied. The source owns all poses and clothing. Its location is
read from the spec; local raw inputs live under ignored
output/imagegen/raw/companion-walk rather than the published asset folder.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "design/assets/azar-walk.json"


def head_center(image):
    alpha = image.getchannel("A")
    centers = []
    for y in range(max(1, image.height // 5)):
        xs = [x for x in range(image.width) if alpha.getpixel((x, y))]
        if xs:
            centers.append((xs[0] + xs[-1]) / 2)
    return median(centers) if centers else image.width / 2


def main():
    spec = json.loads(SPEC.read_text())
    source = ROOT / spec["source"]
    image = Image.open(source).convert("RGBA")
    image.putalpha(image.getchannel("A").point(lambda a: 255 if a > 110 else 0))
    alpha = image.getchannel("A")
    bands, start = [], None
    for y in range(image.height):
        occupied = sum(alpha.getpixel((x, y)) > 0 for x in range(image.width)) >= 10
        if occupied and start is None:
            start = y
        elif not occupied and start is not None:
            bands.append((start, y))
            start = None
    if start is not None:
        bands.append((start, image.height))
    if len(bands) != 4:
        raise ValueError(f"Expected four separated generated rows, got {bands}")
    boundaries = [0] + [round((bands[i][1] + bands[i+1][0]) / 2) for i in range(3)] + [image.height]
    cells = []
    for row in [spec["sourceDirections"].index(direction) for direction in spec["directions"]]:
        for col in range(4):
            cell = image.crop((round(col * image.width / 4), boundaries[row],
                               round((col + 1) * image.width / 4), boundaries[row+1]))
            box = cell.getchannel("A").getbbox()
            if not box:
                raise ValueError(f"Missing sprite {row}:{col}")
            cells.append(cell.crop(box))
    scale = spec["standingHeight"] / median(cell.height for cell in cells)
    sheet = Image.new("RGBA", (256, 256))
    frames = []
    for index, cell in enumerate(cells):
        sprite = cell.resize((max(1, round(cell.width * scale)),
                              spec["standingHeight"]), Image.Resampling.NEAREST)
        sprite = sprite.crop(sprite.getchannel("A").getbbox())
        x, y = round(32 - head_center(sprite)), 60 - sprite.height
        if x < 1 or y < 1 or x + sprite.width > 63:
            raise ValueError(f"Sprite {index} exceeds its 64px frame")
        frame = Image.new("RGBA", (64, 64))
        frame.alpha_composite(sprite, (x, y))
        sheet.alpha_composite(frame, ((index % 4) * 64, (index // 4) * 64))
        frames.append({"index": index, "direction": spec["directions"][index // 4],
                       "alphaBounds": list(frame.getchannel("A").getbbox()),
                       "sha256": hashlib.sha256(frame.tobytes()).hexdigest()})
    destination = ROOT / spec["output"]
    sheet.save(destination, optimize=True)
    spec["normalization"] = {"size": [256, 256], "frameSize": [64, 64],
                             "anchor": [32, 60], "sharedHorizontalScale": scale,
                             "height": spec["standingHeight"], "horizontalAnchor": "head-band-center",
                             "sourceSize": list(image.size), "rowBoundaries": boundaries,
                             "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                             "outputSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                             "frames": frames}
    SPEC.write_text(json.dumps(spec, indent=2) + "\n")
    print(destination, sheet.size)


if __name__ == "__main__":
    main()

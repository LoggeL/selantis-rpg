#!/usr/bin/env python3
"""Technically normalize generated novel Lia walking atlases only.

No authored pixels: alpha threshold, row gap detection, crop, nearest resize,
shared generated-color palette and foot anchoring. Irregular raw row spacing
must not let the following row's head leak into a walking frame.
"""
from __future__ import annotations

import hashlib
import importlib
import json
from pathlib import Path
from statistics import median

from PIL import Image

from build_pixel_unification_story import apply_palette, foot_center

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "design/assets/lia-novel-walk.json"
RAW = ROOT / "output/imagegen/raw/novel-characters"


def extract(asset):
    image = Image.open(ROOT / asset["raw"]).convert("RGBA")
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
        raise ValueError(f"Expected exactly four sprite rows: {asset['name']}: {bands}")
    boundaries = [0] + [round((bands[i][1] + bands[i+1][0]) / 2) for i in range(3)] + [image.height]
    cells = []
    for row in range(4):
        for col in range(4):
            cell = image.crop((round(col * image.width / 4), boundaries[row],
                               round((col + 1) * image.width / 4), boundaries[row+1]))
            box = cell.getchannel("A").getbbox()
            if box is None:
                raise ValueError(f"Missing sprite {asset['name']}:{row}:{col}")
            cells.append(cell.crop(box))
    return cells, boundaries


def normalize(cells):
    scale = 37 / median(c.height for c in cells)
    frames = []
    for cell in cells:
        small = cell.resize((max(1, round(cell.width * scale)), max(1, round(cell.height * scale))), Image.Resampling.NEAREST)
        small = small.crop(small.getchannel("A").getbbox())
        x, y = round(32 - foot_center(small)), 60 - small.height
        if x < 1 or y < 1 or x + small.width > 63:
            raise ValueError("Sprite spills into 64px frame gutter")
        frame = Image.new("RGBA", (64, 64))
        frame.alpha_composite(small, (x, y))
        frames.append(frame)
    return frames


def main():
    spec = json.loads(SPEC.read_text())
    # The original complete atlases are retained as identity/history references.
    # Current gait assets have their own exact source strips and reproducer.
    if any("currentMotionSpec" in asset for asset in spec["assets"]):
        if not all("currentMotionSpec" in asset for asset in spec["assets"]):
            raise ValueError("Motion migration is incomplete; use each current asset reproducer until all three are registered")
        receipt, contact = [], Image.new("RGBA", (768, 256))
        for index, asset in enumerate(spec["assets"]):
            module = importlib.import_module(Path(asset["currentNormalizer"]).stem)
            module.main()
            image = Image.open(ROOT / asset["file"]).convert("RGBA")
            contact.alpha_composite(image, (index * 256, 0))
            frames = [image.crop((i % 4 * 64, i // 4 * 64, (i % 4 + 1) * 64, (i // 4 + 1) * 64)) for i in range(16)]
            receipt.append({"name": asset["name"], "file": asset["file"], "size": list(image.size),
                            "currentMotionSpec": asset["currentMotionSpec"],
                            "currentNormalizer": asset["currentNormalizer"],
                            "fileSha256": hashlib.sha256((ROOT / asset["file"]).read_bytes()).hexdigest(),
                            "frames": [{"index": i, "direction": ["south", "west", "east", "north"][i//4],
                                        "alphaBounds": list(frame.getchannel("A").getbbox())} for i, frame in enumerate(frames)]})
        contact.resize((1536, 512), Image.Resampling.NEAREST).save(RAW / "lia-wardrobe-contact.png")
        (RAW / "lia-walk-normalization-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
        return
    all_frames, boundaries = {}, {}
    for asset in spec["assets"]:
        cells, boundaries[asset["name"]] = extract(asset)
        all_frames[asset["name"]] = normalize(cells)
    colors = [rgb[:3] for frames in all_frames.values() for frame in frames
              for rgb in frame.get_flattened_data() if rgb[3]]
    color_image = Image.new("RGB", (len(colors), 1))
    color_image.putdata(colors)
    palette = color_image.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    receipt = []
    contact = Image.new("RGBA", (768, 256))
    for atlas_index, asset in enumerate(spec["assets"]):
        frames = [apply_palette(f, palette) for f in all_frames[asset["name"]]]
        sheet = Image.new("RGBA", (256, 256))
        for i, frame in enumerate(frames):
            sheet.alpha_composite(frame, ((i % 4) * 64, (i // 4) * 64))
        destination = ROOT / asset["file"]
        sheet.save(destination, optimize=True)
        contact.alpha_composite(sheet, (atlas_index * 256, 0))
        sheet.resize((1024, 1024), Image.Resampling.NEAREST).save(RAW / f"{asset['name']}-preview.png")
        receipt.append({"name": asset["name"], "file": asset["file"], "size": [256, 256],
                        "rawRowBoundaries": boundaries[asset["name"]],
                        "rawSha256": hashlib.sha256((ROOT / asset["raw"]).read_bytes()).hexdigest(),
                        "fileSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                        "frames": [{"index": i, "direction": ["south", "west", "east", "north"][i//4],
                                    "alphaBounds": list(f.getchannel("A").getbbox()),
                                    "opaqueColors": len({rgb[:3] for rgb in f.get_flattened_data() if rgb[3]})}
                                   for i, f in enumerate(frames)]})
        print(asset["name"], destination, boundaries[asset["name"]])
    contact.resize((1536, 512), Image.Resampling.NEAREST).save(RAW / "lia-wardrobe-contact.png")
    (RAW / "lia-walk-normalization-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")


if __name__ == "__main__":
    main()

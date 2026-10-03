#!/usr/bin/env python3
"""Normalize generated story cast only; leaves manifest and scene code untouched."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "design/assets/pixel-unification-story.json"
RAW = ROOT / "output/imagegen/raw/pixel-unification-story"
FRAME = 64
FOOT = 60


def source_cells(asset):
    image = Image.open(ROOT / asset["raw"]).convert("RGBA")
    result = []
    for i in range(asset["cols"] * asset["rows"]):
        x, y = i % asset["cols"], i // asset["cols"]
        cell = image.crop((
            round(x * image.width / asset["cols"]),
            round(y * image.height / asset["rows"]),
            round((x + 1) * image.width / asset["cols"]),
            round((y + 1) * image.height / asset["rows"]),
        ))
        cell.putalpha(cell.getchannel("A").point(lambda a: 255 if a > 110 else 0))
        box = cell.getchannel("A").getbbox()
        if not box:
            raise ValueError(f"Empty generated frame {asset['name']}:{i}")
        result.append(cell.crop(box))
    return result


def foot_center(image):
    alpha = image.getchannel("A")
    centers = []
    for y in range(max(0, image.height - 3), image.height):
        xs = [x for x in range(image.width) if alpha.getpixel((x, y))]
        if xs:
            centers.append((xs[0] + xs[-1]) / 2)
    return median(centers) if centers else image.width / 2


def normalize(asset):
    cells = source_cells(asset)
    mode = asset["mode"]
    if mode == "lia-walk":
        scales = [37 / median(c.height for c in cells)] * len(cells)
    elif mode == "lia-read":
        scales = [37 / median(cells[i].height for i in [3, 6, 7])] * len(cells)
    elif mode == "lia-hide":
        # Each direction retains a single scale so crouches preserve physical head size.
        scales = [37 / cells[0].height] * 4 + [37 / cells[4].height] * 4
    elif mode == "lia-story-poses":
        scales = [37 / median(cells[i].height for i in [5, 6])] * len(cells)
    elif mode == "road":
        scales = [47 / cells[0].height, 40 / cells[1].height]
    elif mode == "story":
        scales = [h / c.height for h, c in zip([37, 37, 42, 28, 30, 43, 37, 37], cells)]
    elif mode == "horse":
        scales = [48 / median(c.width for c in cells)] * len(cells)
    else:
        raise ValueError(mode)
    result = []
    for i, (cell, scale) in enumerate(zip(cells, scales)):
        width, height = max(1, round(cell.width * scale)), max(1, round(cell.height * scale))
        small = cell.resize((width, height), Image.Resampling.NEAREST)
        # Reduction can discard isolated edge pixels. Re-crop its genuine alpha
        # before placing the ground anchor so low/lying poses never float.
        small = small.crop(small.getchannel("A").getbbox())
        width, height = small.size
        frame_width = asset.get("frameWidth", FRAME)
        x = round(32 - foot_center(small)) if mode not in ["horse", "road"] else (frame_width - width) // 2
        y = FOOT - height
        if x < 1 or y < 1 or x + width > frame_width - 1 or y + height > 63:
            raise ValueError(f"Frame spills into gutter: {asset['name']}:{i}")
        frame = Image.new("RGBA", (frame_width, FRAME), (0, 0, 0, 0))
        frame.alpha_composite(small, (x, y))
        result.append(frame)
    return result


def make_palette(frames):
    """Use only generated opaque pixels; transparent RGB must not consume colors."""
    colors = []
    for frame in frames:
        colors.extend((r, g, b) for r, g, b, a in frame.get_flattened_data() if a)
    image = Image.new("RGB", (len(colors), 1))
    image.putdata(colors)
    return image.quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def apply_palette(frame, palette):
    alpha = frame.getchannel("A")
    result = frame.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE).convert("RGBA")
    result.putalpha(alpha)
    return result


def build_portrait(portrait_asset):
    """Only technical downsize/palette normalization; color editing is imagegen."""
    portrait = Image.open(ROOT / portrait_asset["raw"]).convert("RGB").resize((48, 48), Image.Resampling.NEAREST)
    portrait = portrait.quantize(colors=24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    destination = ROOT / portrait_asset["file"]
    portrait.save(destination, optimize=True)
    portrait.resize((192, 192), Image.Resampling.NEAREST).save(RAW / "portrait-lia-preview.png")
    report = {"file": portrait_asset["file"], "size": [48, 48], "bytes": destination.stat().st_size,
              "opaqueColors": len(set(portrait.get_flattened_data()))}
    print("portrait-lia", portrait.size, destination.stat().st_size, "bytes")
    return report


def main():
    spec = json.loads(SPEC.read_text())
    if "--portrait-only" in sys.argv:
        report = build_portrait(next(a for a in spec["assets"] if a["name"] == "portrait-lia"))
        (RAW / "portrait-only-receipt.json").write_text(json.dumps(report, indent=2) + "\n")
        return
    extra = json.loads((ROOT / "design/assets/pixel-unification-story-poses.json").read_text())
    spec["assets"].extend(extra["assets"])
    assets = {a["name"]: a for a in spec["assets"]}
    frames = {a["name"]: normalize(a) for a in spec["assets"] if a["mode"] != "portrait"}
    # Lia shares costume colors over all directions, reading, crouching and travel.
    lia_palette = make_palette(
        frames["lia-walk"] + frames["lia-read"] + frames["lia-hide"] + frames["lia-story-poses"] + [frames["story-actors"][7]] * 16
    )
    for name in ["lia-walk", "lia-read", "lia-hide", "lia-story-poses"]:
        frames[name] = [apply_palette(f, lia_palette) for f in frames[name]]
    frames["story-actors"][7] = apply_palette(frames["story-actors"][7], lia_palette)
    for indices in [[0, 1], [2], [3, 4], [5], [6]]:
        palette = make_palette([frames["story-actors"][i] for i in indices])
        for i in indices:
            frames["story-actors"][i] = apply_palette(frames["story-actors"][i], palette)
    horse_palette = make_palette(frames["raid-horse"])
    frames["raid-horse"] = [apply_palette(f, horse_palette) for f in frames["raid-horse"]]
    road_palette = make_palette(frames["road-travelers"])
    frames["road-travelers"] = [apply_palette(f, road_palette) for f in frames["road-travelers"]]
    receipt = []
    for name, cells in frames.items():
        asset = assets[name]
        frame_width = asset.get("frameWidth", FRAME)
        sheet = Image.new("RGBA", (asset["cols"] * frame_width, asset["rows"] * FRAME))
        for i, frame in enumerate(cells):
            sheet.alpha_composite(frame, ((i % asset["cols"]) * frame_width, (i // asset["cols"]) * FRAME))
        destination = ROOT / asset["file"]
        sheet.save(destination, optimize=True)
        sheet.resize((sheet.width * 4, sheet.height * 4), Image.Resampling.NEAREST).save(RAW / f"{name}-preview.png")
        report = {
            "file": asset["file"], "size": list(sheet.size), "bytes": destination.stat().st_size,
            "frames": [{"index": i, "alphaBounds": list(f.getchannel("A").getbbox()),
                        "opaqueColors": len({(r, g, b) for r, g, b, a in f.get_flattened_data() if a})}
                       for i, f in enumerate(cells)],
        }
        receipt.append(report)
        print(name, sheet.size, destination.stat().st_size, "bytes")
    portrait_asset = assets["portrait-lia"]
    receipt.append(build_portrait(portrait_asset))
    (RAW / "normalization-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")


if __name__ == "__main__":
    main()

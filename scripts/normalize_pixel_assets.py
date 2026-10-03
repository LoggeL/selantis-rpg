#!/usr/bin/env python3
"""Normalize authored pixel assets from a JSON batch manifest (requires Pillow)."""

import argparse
import json
import os
from pathlib import Path
import tempfile

from PIL import Image, ImageColor


def dimensions(value, label):
    if (not isinstance(value, list) or len(value) != 2
            or any(type(v) is not int or v < 1 for v in value)):
        raise ValueError(f"{label} must be two positive integers")
    return tuple(value)


def prepare_job(job, base, overwrite):
    source = (base / job["source"]).resolve()
    output = (base / job["output"]).resolve()
    if source == output:
        raise ValueError("source and output must differ")
    if output.suffix.lower() != ".png":
        raise ValueError(f"output must be PNG: {output}")
    if output.exists() and not overwrite:
        raise ValueError(f"output exists; use --overwrite: {output}")
    size = dimensions(job["size"], "size")
    grid = dimensions(job.get("frameGrid", [1, 1]), "frameGrid")
    with Image.open(source) as opened:
        source_size = opened.size
    if any(n % count for n, count in zip(source_size, grid)):
        raise ValueError(f"source size is not divisible by frameGrid: {source}")
    if any(n % count for n, count in zip(size, grid)):
        raise ValueError(f"output size is not divisible by frameGrid: {output}")
    src_frame = tuple(n // count for n, count in zip(source_size, grid))
    dst_frame = tuple(n // count for n, count in zip(size, grid))
    if src_frame[0] * dst_frame[1] != src_frame[1] * dst_frame[0]:
        raise ValueError(f"frame aspect ratio differs; author an explicit crop first: {source}")
    palette_path = (base / job["palette"]).resolve()
    colors = json.loads(palette_path.read_text(encoding="utf-8"))
    if not isinstance(colors, list) or not 1 <= len(colors) <= 256:
        raise ValueError("palette must be a JSON list of 1 to 256 #RRGGBB colors")
    if any(not isinstance(c, str) or len(c) != 7 or not c.startswith("#") for c in colors):
        raise ValueError("palette entries must use #RRGGBB")
    rgb = [ImageColor.getrgb(color) for color in colors]
    palette = Image.new("P", (1, 1))
    # Fill unused indices with an existing color, never introduce implicit black.
    palette.putpalette([channel for color in (rgb + [rgb[-1]] * (256 - len(rgb)))
                        for channel in color])
    return source, output, size, grid, src_frame, dst_frame, palette, set(rgb)


def normalize(prepared):
    source, output, size, grid, src_frame, dst_frame, palette, allowed = prepared
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    with Image.open(source) as opened:
        original = opened.convert("RGBA")
    for row in range(grid[1]):
        for col in range(grid[0]):
            x, y = col * src_frame[0], row * src_frame[1]
            frame = original.crop((x, y, x + src_frame[0], y + src_frame[1]))
            frame = frame.resize(dst_frame, Image.Resampling.NEAREST)
            alpha = frame.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
            normalized = frame.convert("RGB").quantize(
                palette=palette, dither=Image.Dither.NONE).convert("RGBA")
            normalized.putalpha(alpha)
            normalized.paste((0, 0, 0, 0), (0, 0, *dst_frame), alpha.point(lambda a: 255 - a))
            result.paste(normalized, (col * dst_frame[0], row * dst_frame[1]))
    pixels = set(zip(*(channel.tobytes() for channel in result.split())))
    visible = {p[:3] for p in pixels if p[3] == 255}
    if result.size != size or not visible.issubset(allowed):
        raise ValueError("normalization verification failed")
    if any(p[3] not in (0, 255) or (p[3] == 0 and p[:3] != (0, 0, 0)) for p in pixels):
        raise ValueError("alpha verification failed")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Replace only after a full PNG has been written successfully.
    fd, temporary = tempfile.mkstemp(prefix=".pixel-", suffix=".png", dir=output.parent)
    os.close(fd)
    try:
        result.save(temporary, format="PNG")
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {"output": str(output), "size": list(size), "visibleColors": len(visible),
            "alpha": "0/255", "frameGrid": list(grid)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        manifest_path = args.manifest.resolve()
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        jobs = manifest.get("assets")
        if not isinstance(jobs, list) or not jobs:
            raise ValueError("manifest must contain a nonempty assets list")
        prepared = [prepare_job(job, manifest_path.parent, args.overwrite) for job in jobs]
        outputs = [job[1] for job in prepared]
        if len(set(outputs)) != len(outputs):
            raise ValueError("manifest contains duplicate outputs")
        if set(outputs).intersection(job[0] for job in prepared):
            raise ValueError("an output would overwrite a batch source")
        for job in prepared:
            print(json.dumps(normalize(job), ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, f"normalization failed: {error}\n")


if __name__ == "__main__":
    main()

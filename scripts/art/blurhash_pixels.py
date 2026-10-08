#!/usr/bin/env python3
"""Decode/downsample image regions for build_blurhashes.mjs, using Pillow only.

Input is one JSON document on stdin; each stdout line is an image's sampled RGBA
data. The official JavaScript BlurHash encoder owns the actual encoding.
"""
from __future__ import annotations

import base64
from collections import deque
import json
from pathlib import PurePosixPath
import sys

from PIL import Image


def positive_int(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{name} must be a positive integer, got {value!r}")
    return value


def frame_rects(file: str, meta: dict, width: int, height: int) -> list[dict]:
    path = PurePosixPath(file)
    rects = []
    if file.startswith("assets/sprites/") and (path.stem.endswith("-walk") or meta.get("sheet") == "sneak"):
        frame_w = positive_int(meta.get("frameW", 64), "frameW")
        frame_h = positive_int(meta.get("frameH", 64), "frameH")
        cols = positive_int(meta.get("cols", 4), "cols")
        rows = positive_int(meta.get("rows", 4), "rows")
        rects = [{"x": col * frame_w, "y": row * frame_h, "width": frame_w, "height": frame_h}
                 for row in range(rows) for col in range(cols)]
    elif file == "assets/ui/items.png":
        cell = positive_int(meta.get("cell", 32), "cell")
        rects = [{"x": col * cell, "y": row * cell, "width": cell, "height": cell}
                 for row in range(height // cell) for col in range(width // cell)]
    elif "frameW" in meta and "frameH" in meta and ("cols" in meta or "rows" in meta):
        frame_w = positive_int(meta["frameW"], "frameW")
        frame_h = positive_int(meta["frameH"], "frameH")
        cols = positive_int(meta.get("cols", width // frame_w), "cols")
        rows = positive_int(meta.get("rows", height // frame_h), "rows")
        rects = [{"x": col * frame_w, "y": row * frame_h, "width": frame_w, "height": frame_h}
                 for row in range(rows) for col in range(cols)]
    elif positive_int(meta.get("frames", 1), "frames") > 1:
        count = meta["frames"]
        frame_w = positive_int(meta.get("frameW", width // count), "frameW")
        rects = [{"x": frame * frame_w, "y": 0, "width": frame_w, "height": height} for frame in range(count)]
    for rect in rects:
        if rect["x"] + rect["width"] > width or rect["y"] + rect["height"] > height:
            raise ValueError(f"{file}: frame rectangle {rect} lies outside {width}x{height}")
    return rects


def sampled(image: Image.Image, edge: int) -> dict:
    scale = min(1.0, edge / max(image.size))
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    has_alpha = image.getchannel("A").getextrema()[0] < 255
    small = image.resize(size, Image.Resampling.BILINEAR)
    pixels = bytearray(small.tobytes())
    alpha = bytearray(len(pixels)) if has_alpha else None
    # Extend the nearest visible colour through transparent pixels. BlurHash
    # ignores alpha; a black RGB matte would otherwise darken sprite edges.
    if has_alpha:
        queue: deque[int] = deque()
        visited = bytearray(size[0] * size[1])
        for index in range(len(visited)):
            offset = index * 4
            opacity = pixels[offset + 3]
            alpha[offset:offset + 4] = bytes((opacity, opacity, opacity, 255))
            if opacity:
                visited[index] = 1
                queue.append(index)
        while queue:
            index = queue.popleft()
            x, y = index % size[0], index // size[0]
            neighbours = []
            if x: neighbours.append(index - 1)
            if x + 1 < size[0]: neighbours.append(index + 1)
            if y: neighbours.append(index - size[0])
            if y + 1 < size[1]: neighbours.append(index + size[0])
            for neighbour in neighbours:
                if visited[neighbour]:
                    continue
                visited[neighbour] = 1
                pixels[neighbour * 4:neighbour * 4 + 3] = pixels[index * 4:index * 4 + 3]
                queue.append(neighbour)
    result = {"width": size[0], "height": size[1], "rgba": base64.b64encode(pixels).decode("ascii")}
    if alpha is not None:
        result["alpha"] = base64.b64encode(alpha).decode("ascii")
    return result


def main() -> None:
    payload = json.load(sys.stdin)
    edge = positive_int(payload["settings"]["sampleEdge"], "sampleEdge")
    for source in payload["images"]:
        with Image.open(source["absolute"]) as raw:
            image = raw.convert("RGBA")
        result = {"file": source["file"], "width": image.width, "height": image.height, "preview": sampled(image, edge)}
        rects = frame_rects(source["file"], source["meta"], image.width, image.height)
        if rects:
            result["frames"] = [{**rect, "preview": sampled(image.crop((rect["x"], rect["y"],
                                  rect["x"] + rect["width"], rect["y"] + rect["height"])), edge)} for rect in rects]
        print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"BlurHash sampling: {error}", file=sys.stderr)
        raise SystemExit(1) from error

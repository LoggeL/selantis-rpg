#!/usr/bin/env python3
"""Stage the approved message 08 farmhouse image without repainting or resizing it."""
from __future__ import annotations

import hashlib
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output/imagegen/raw/message08-farm-furnishing/farm-interior-furnished-v2.png"
TARGET = ROOT / "game/public/assets/bg/farm-interior-furnished.png"


def main() -> None:
    data = SOURCE.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Approved farmhouse source is not a PNG")
    width, height = struct.unpack(">II", data[16:24])
    if not 1.75 < width / height < 1.80:
        raise ValueError(f"Expected a 16:9 room plate, received {width}x{height}")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, TARGET)
    if hashlib.sha256(TARGET.read_bytes()).digest() != hashlib.sha256(data).digest():
        raise RuntimeError("Staged farmhouse differs from approved source")
    print(f"{TARGET.relative_to(ROOT)}: {width}x{height}, {len(data)} bytes, source hash verified")


if __name__ == "__main__":
    main()

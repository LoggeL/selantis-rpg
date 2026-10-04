#!/usr/bin/env python3
"""Stage message 12's sleeping observation frame without changing its pixels."""
from pathlib import Path
import json

from cinematic_asset_delivery import copy_approved_source, delivery_record

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output/imagegen/raw/message12-camp-observe/cinematic-camp-observe-v1.png"
TARGET = ROOT / "game/public/assets/cut/cinematic-camp-observe-message12.png"
SPEC = ROOT / "design/assets/message12-camp-observe.json"


def main() -> None:
    copy_approved_source(SOURCE, TARGET)
    metadata = delivery_record(SOURCE, TARGET, ROOT)
    spec = json.loads(SPEC.read_text())
    spec["delivery"] = metadata
    SPEC.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n")
    print(f"{metadata['path']}: {metadata['width']}x{metadata['height']}, source hash verified")


if __name__ == "__main__":
    main()

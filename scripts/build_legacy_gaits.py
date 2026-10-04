#!/usr/bin/env python3
"""Install generated legacy walk cells, preserving every other original RGBA cell.

This performs technical extraction and nearest-neighbour normalization only.
Generated image sources contain all character artwork and walking poses.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "design/assets/legacy-gaits.json"
RAW = ROOT / "output/imagegen/raw/legacy-gaits"
PREVIEWS = RAW


def digest(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest()


def frame(sheet: Image.Image, index: int) -> Image.Image:
    return sheet.crop((index % 4 * 64, index // 4 * 64,
                       index % 4 * 64 + 64, index // 4 * 64 + 64))


def extract_strip(path: Path) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    # Remove alpha edge noise and restore the shipped binary-alpha contract.
    image.putalpha(image.getchannel("A").point(lambda a: 255 if a >= 100 else 0))
    cells = []
    for col in range(4):
        cell = image.crop((round(col * image.width / 4), 0,
                           round((col + 1) * image.width / 4), image.height))
        box = cell.getchannel("A").getbbox()
        if box is None:
            raise ValueError(f"Empty generated cell {path}:{col}")
        cells.append(cell.crop(box))
    return cells


def torso_center(sprite: Image.Image) -> float:
    """Anchor by torso instead of alternating boot extensions."""
    alpha = sprite.getchannel("A")
    centers = []
    for y in range(round(sprite.height * .25), round(sprite.height * .60)):
        xs = [x for x in range(sprite.width) if alpha.getpixel((x, y)) >= 100]
        if xs:
            centers.append((xs[0] + xs[-1]) / 2)
    return median(centers) if centers else sprite.width / 2


def main() -> None:
    spec = json.loads(SPEC.read_text())
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    evidence = []
    for asset in spec["assets"]:
        destination = ROOT / asset["file"]
        baseline_path = ROOT / asset["baseline"]
        original = Image.open(baseline_path).convert("RGBA")
        current = Image.open(destination).convert("RGBA")
        if current.size != original.size:
            raise ValueError(f"Asset dimensions changed: {destination}")
        replacement_indices = {r["row"] * 4 + col for r in asset["rows"] for col in range(4)}
        untouched = [i for i in range(original.width // 64 * original.height // 64)
                     if i not in replacement_indices]
        for i in untouched:
            if digest(frame(current, i)) != digest(frame(original, i)):
                raise ValueError(f"Unowned original cell changed: {destination}:{i}")
        output = original.copy()
        changed = []
        for row in asset["rows"]:
            source_path = ROOT / row["source"]
            cells = extract_strip(source_path)
            scale = row["height"] / median(cell.height for cell in cells)
            normalized_cells = []
            for col, cell in enumerate(cells):
                sprite = cell.resize((max(1, round(cell.width * scale)),
                                      max(1, round(cell.height * scale))), Image.Resampling.NEAREST)
                box = sprite.getchannel("A").getbbox()
                if box is None:
                    raise ValueError(f"Sprite vanished during normalization: {source_path}:{col}")
                sprite = sprite.crop(box)
                position = (round(32 - torso_center(sprite)), 60 - sprite.height)
                if min(position) < 1 or position[0] + sprite.width > 63:
                    raise ValueError(f"Sprite exceeds 64px cell: {source_path}:{col}, {sprite.size}")
                normalized = Image.new("RGBA", (64, 64))
                normalized.alpha_composite(sprite, position)
                index = row["row"] * 4 + col
                output.paste(normalized, (col * 64, row["row"] * 64))
                normalized_cells.append(normalized)
                changed.append({"index": index, "direction": row["direction"],
                                "phase": row["phases"][col], "bounds": normalized.getchannel("A").getbbox(),
                                "sha256RGBA": digest(normalized),
                                "lowerBodySha256RGBA": digest(normalized.crop((0, 43, 64, 64)))})
            row["normalization"] = {"sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
                                    "sharedScale": scale, "sourceSize": list(Image.open(source_path).size)}
            strip = Image.new("RGBA", (256, 64))
            for col, cell in enumerate(normalized_cells):
                strip.paste(cell, (col * 64, 0))
            preview_prefix = PREVIEWS / (asset["name"] + "-" + row["direction"])
            strip.resize((1024, 256), Image.Resampling.NEAREST).save(str(preview_prefix) + "-walk-preview.png")
            animated = []
            for cell in normalized_cells:
                display = Image.new("RGBA", (64, 64), (45, 50, 58, 255))
                display.alpha_composite(cell)
                animated.append(display.resize((192, 192), Image.Resampling.NEAREST).convert("RGB"))
            animated[0].save(str(preview_prefix) + "-walk-preview.gif", save_all=True,
                             append_images=animated[1:], duration=120, loop=0)
        for i in untouched:
            assert digest(frame(output, i)) == digest(frame(original, i))
        output.save(destination, optimize=True)
        reread = Image.open(destination).convert("RGBA")
        assert reread.tobytes() == output.tobytes()
        preview = PREVIEWS / (asset["name"] + "-normalized-preview.png")
        output.resize((output.width * 4, output.height * 4), Image.Resampling.NEAREST).save(preview)
        evidence.append({"name": asset["name"], "file": asset["file"], "size": list(output.size),
                         "outputSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                         "replacedCells": changed, "preservedCellsRGBA": untouched,
                         "preservedCellHashes": {str(i): digest(frame(reread, i)) for i in untouched},
                         "preview": str(preview.relative_to(ROOT))})
        print(asset["name"], "replaced", sorted(replacement_indices), "preserved", untouched)
    spec["delivery"] = evidence
    SPEC.write_text(json.dumps(spec, indent=2) + "\n")


if __name__ == "__main__":
    main()

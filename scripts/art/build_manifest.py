#!/usr/bin/env python3
"""Rebuilds game/public/assets/manifest.json by scanning game/public/assets.

Usage:  python3 scripts/art/build_manifest.py [--check]
  --check   only validate (exit 1 on problems), do not write

Folder conventions (DESIGN.md §3, schema in docs/rebuild/art-pipeline.md, typed in game/src/art/manifest.ts):
  sprites/<id>-walk.png               walk sheet 256×256 (4×4 × 64×64; rows down,left,right,up), foot (32,60)
  sprites/<id>-<pose>[-<dir>].png     pose 64×64 (lying 128×64), optional strip of N frames (sidecar "frames")
  portraits/<id>[-<mood>].png         256×256; no mood suffix = neutral
  bg/<id>.png|jpg                     map backgrounds (640×360 or 1280×720)
  cut/<id>.jpg|png                    plates / cutscenes (1280×720)
  props/<id>.png                      props, foot anchor bottom centre unless the sidecar says otherwise
  ui/items.png + ui/items.json        item icon atlas (32×32 cells)
  anything else                       → "images" (key = folder/name without extension)
Every image may have a sidecar <same name>.json whose fields are merged into its entry
(e.g. props: anchor, footprint, frames, frameW, fps, sway, light, lights, anchors; sprites: facing, foot,
frames, fps, height, character, pose; backgrounds: anything the world layer wants to read).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import ASSETS, load_json, rel  # noqa: E402

OUT = ASSETS / "manifest.json"
DIRS = ("down", "up", "left", "right")
MOODS = ("neutral", "happy", "sad", "angry", "surprised", "determined", "hurt", "pained", "thinking", "scared",
         "smirk", "tired", "crying", "shocked", "worried", "laughing", "grim", "glow", "ashamed")
POSE_NAMES = ("idle", "sit", "kneel", "lie", "read", "sit-read", "crouch", "sneak", "cast", "attack", "hurt", "hit",
              "carry", "sleep", "struggle", "wave", "point", "talk", "cheer", "shoot", "fall", "interact", "run",
              "dead", "bound", "tied", "ride", "lie-bound", "sit-bound")
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")


def url(p: Path) -> str:
    return str(p.relative_to(ASSETS.parent))


def sidecar(p: Path) -> dict:
    s = p.with_suffix(".json")
    return load_json(s, {}) if s.is_file() else {}


def size(p: Path) -> tuple[int, int]:
    with Image.open(p) as im:
        return im.size


def known_characters() -> set[str]:
    ids = {p.stem[:-5] for p in (ASSETS / "sprites").glob("*-walk.png")}
    cast = load_json(Path(__file__).resolve().parent / "cast.json", {"characters": {}})["characters"]
    ids |= set(cast)
    for j in (ASSETS / "sprites").glob("*.json"):
        c = load_json(j, {}).get("character")
        if c:
            ids.add(c)
    return ids


def split_sprite(stem: str, chars: set[str]) -> tuple[str, str, str | None] | None:
    """'lia-cloak-sit-left' → ('lia-cloak', 'sit', 'left')."""
    for cid in sorted(chars, key=len, reverse=True):
        if stem.startswith(cid + "-"):
            rest = stem[len(cid) + 1:]
            d = None
            for dd in DIRS:
                if rest.endswith("-" + dd):
                    rest, d = rest[: -len(dd) - 1], dd
                    break
            return cid, rest, d
    for pose in sorted(POSE_NAMES, key=len, reverse=True):
        if stem.endswith("-" + pose):
            return stem[: -len(pose) - 1], pose, None
    return None


def scan(warnings: list[str]) -> dict:
    m: dict = {"version": 1, "characters": {}, "portraits": {}, "backgrounds": {}, "plates": {}, "props": {},
               "icons": {"atlas": "", "cell": 32, "cols": 0, "ids": {}}, "images": {}}
    chars = known_characters()
    sprites = ASSETS / "sprites"
    for p in sorted(sprites.glob("*.png")) if sprites.is_dir() else []:
        meta = sidecar(p)
        w, h = size(p)
        if p.stem.endswith("-walk"):
            cid = p.stem[:-5]
            if (w, h) != (256, 256):
                warnings.append(f"{url(p)}: walk sheet should be 256×256, is {w}×{h}")
            c = m["characters"].setdefault(cid, {"poses": {}})
            c["walk"] = {"file": url(p), "frameW": 64, "frameH": 64, "cols": 4, "rows": 4,
                         "dirs": ["down", "left", "right", "up"], "fps": meta.get("fps", 8),
                         "idle": meta.get("idle", [0, 4, 8, 12])}
            c["foot"] = meta.get("foot", [32, 60])
            c["height"] = meta.get("height", 42)
            continue
        parts = (meta.get("character"), meta.get("pose"), meta.get("dir")) if meta.get("character") else \
            split_sprite(p.stem, chars)
        if not parts:
            warnings.append(f"{url(p)}: cannot tell character/pose apart — add a sidecar with character/pose")
            m["images"][f"sprites/{p.stem}"] = {"file": url(p), "w": w, "h": h}
            continue
        cid, pose, d = parts
        frames = int(meta.get("frames", 1))
        fw = int(meta.get("frameW", w // frames))
        entry = {"file": url(p), "w": fw, "h": h, "frames": frames,
                 "foot": meta.get("foot", [fw // 2, 60 if h == 64 else h - 4]),
                 "facing": meta.get("facing", "right")}
        for k in ("fps", "loop", "height"):
            if k in meta:
                entry[k] = meta[k]
        c = m["characters"].setdefault(cid, {"poses": {}})
        pe = c["poses"].setdefault(pose, {})
        if d:
            pe.setdefault("dirs", {})[d] = entry
        else:
            pe.update(entry)
    for cid, c in m["characters"].items():
        for pose, pe in list(c["poses"].items()):
            if "file" not in pe:  # only directional variants: promote one as default
                first = next(iter(pe["dirs"].values()))
                pe.update({k: v for k, v in first.items()})
        if "walk" not in c:
            warnings.append(f"character {cid}: poses but no walk sheet")

    portraits = ASSETS / "portraits"
    pchars = chars | {p.stem for p in portraits.glob("*.png")} if portraits.is_dir() else chars
    for p in sorted(portraits.glob("*.png")) if portraits.is_dir() else []:
        stem = p.stem
        mood = "neutral"
        pid = stem
        for md in sorted(MOODS, key=len, reverse=True):
            if stem.endswith("-" + md) and stem[: -len(md) - 1]:
                pid, mood = stem[: -len(md) - 1], md
                break
        if pid != stem and pid not in pchars:
            warnings.append(f"{url(p)}: mood variant without neutral portrait {pid}.png")
        if size(p) != (256, 256):
            warnings.append(f"{url(p)}: portrait should be 256×256")
        m["portraits"].setdefault(pid, {})[mood] = url(p)

    for folder, key in (("bg", "backgrounds"), ("cut", "plates")):
        d = ASSETS / folder
        for p in sorted(d.iterdir()) if d.is_dir() else []:
            if p.suffix.lower() not in IMG_EXT:
                continue
            w, h = size(p)
            entry = {"file": url(p), "w": w, "h": h, **sidecar(p)}
            if p.stem in m[key]:
                warnings.append(f"{url(p)}: duplicate id {p.stem} (keeping the first)")
                continue
            m[key][p.stem] = entry
            if key == "plates" and p.stat().st_size > 400 * 1024:
                warnings.append(f"{url(p)}: plate larger than 400 KB")

    props = ASSETS / "props"
    for p in sorted(props.glob("*.png")) if props.is_dir() else []:
        meta = sidecar(p)
        w, h = size(p)
        frames = int(meta.get("frames", 1))
        fw = int(meta.get("frameW", w // frames))
        entry = {"file": url(p), "w": fw, "h": h, "frames": frames, "anchor": meta.get("anchor", [fw // 2, h])}
        if "footprint" in meta:
            entry["footprint"] = meta["footprint"]
        else:
            fh = max(4, min(12, round(h * 0.25)))
            entry["footprint"] = {"x": -round(fw * 0.4), "y": -fh, "w": round(fw * 0.8), "h": fh}
        for k, v in meta.items():
            if k not in entry and k not in ("frameW",):
                entry[k] = v
        m["props"][p.stem] = entry

    atlas = ASSETS / "ui/items.png"
    if atlas.is_file():
        meta = load_json(ASSETS / "ui/items.json", {})
        w, h = size(atlas)
        cell = int(meta.get("cell", 32))
        m["icons"] = {"atlas": url(atlas), "cell": cell, "cols": w // cell,
                      "ids": {i: k for k, i in enumerate(meta.get("ids", []))}}
        if len(meta.get("ids", [])) > (w // cell) * (h // cell):
            warnings.append("ui/items.json lists more ids than the atlas has cells")

    known = {"sprites", "portraits", "bg", "cut", "props"}
    for p in sorted(ASSETS.rglob("*")):
        if p.suffix.lower() not in IMG_EXT or p == atlas:
            continue
        top = p.relative_to(ASSETS).parts[0]
        if top in known:
            continue
        w, h = size(p)
        key = str(p.relative_to(ASSETS).with_suffix(""))
        m["images"][key] = {"file": url(p), "w": w, "h": h, **sidecar(p)}
    return m


def main(argv: list[str]) -> int:
    warnings: list[str] = []
    m = scan(warnings)
    for w in warnings:
        print("WARN", w)
    counts = {k: len(v) for k, v in m.items() if isinstance(v, dict) and k != "icons"}
    counts["icons"] = len(m["icons"]["ids"])
    if "--check" in argv:
        old = load_json(OUT, None)
        same = old == m
        print(f"{rel(OUT)}: {'aktuell' if same else 'VERALTET — python3 scripts/art/build_manifest.py'} {counts}")
        return 0 if same and not warnings else 1
    OUT.write_text(json.dumps(m, ensure_ascii=False, indent=1) + "\n")
    print(f"OK   {rel(OUT)} {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

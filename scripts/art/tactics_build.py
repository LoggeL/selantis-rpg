#!/usr/bin/env python3
"""Processes the raw Codex images of the tactics package into game assets.

  textures  -> game/public/assets/tactics/tex-<id>.png        256x256, seamless, RGB
  props     -> game/public/assets/props/iso-<id>-<n>.png       transparent, bottom-centre anchor
  backdrops -> game/public/assets/tactics/sky-<id>.png          640x360
Also writes docs/rebuild/art/tactics.json (prompts, refs, raw files, outputs) and a contact sheet.

Usage: tactics_build.py [textures|props|backdrops|all] [--pick id=rawname ...]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tactics_prompts import BACKDROPS, DOC, OUT, PROPS, PROPS_OUT, RAW, ROOT, TEXTURES  # noqa: E402

OUTLINE = (24, 18, 26)
TEX_SIZE = 256

# Which raw file wins per asset (default: '<kind>-<id>.png'); regenerated variants are picked here.
PICK: dict[str, str] = {}

# Target heights (px) for iso props on 48x24 tiles (characters are ~42 px tall).
PROP_HEIGHT = {
    "iso-tree": 92, "iso-pine": 96, "iso-bush": 30, "iso-rock": 30, "iso-ruin": 50,
    "iso-banner-light": 70, "iso-banner-dark": 70, "iso-deadtree": 84, "iso-stump": 20, "iso-crate": 30,
    "iso-stake": 46, "iso-campfire": 26,
}
# Max width as a fallback limit.
PROP_WIDTH = {"iso-tree": 92, "iso-pine": 64, "iso-bush": 44, "iso-rock": 44, "iso-ruin": 52,
              "iso-banner-light": 40, "iso-banner-dark": 40, "iso-deadtree": 70, "iso-stump": 30, "iso-crate": 34,
              "iso-stake": 24, "iso-campfire": 40}


def raw_path(kind: str, aid: str) -> Path:
    name = PICK.get(aid, f"{kind}-{aid}.png")
    return RAW / name


# ------------------------------------------------------------------------------------------- textures
def seam_fix(a: np.ndarray, band: int = 20) -> np.ndarray:
    """Cross-fades a narrow band at each edge with the opposite edge so the tile wraps without a hard seam."""
    a = a.astype(np.float64)
    n = a.shape[0]
    out = a.copy()
    for axis in (0, 1):
        rolled = np.roll(out, n // 2, axis=axis)
        idx = np.arange(n)
        d = np.minimum(idx, n - 1 - idx)
        w = np.clip(d / band, 0, 1)
        w = w[:, None, None] if axis == 0 else w[None, :, None]
        # Near the edge use the rolled image (whose wrap point is continuous), inside keep the original.
        out = out * w + rolled * (1 - w)
    return out


def seam_score(a: np.ndarray) -> float:
    a = a.astype(float)
    inner = (np.abs(a[:, 1:] - a[:, :-1]).mean() + np.abs(a[1:] - a[:-1]).mean()) / 2
    seam = (np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2
    return seam / max(inner, 1e-6)


def build_texture(tid: str) -> dict:
    src = raw_path("tex", tid)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    small = np.asarray(im.resize((TEX_SIZE, TEX_SIZE), Image.Resampling.BOX)).astype(np.float64)
    score = seam_score(small)
    fixed = False
    if score > 1.35:
        small = seam_fix(small)
        fixed = True
    out = Image.fromarray(small.clip(0, 255).round().astype(np.uint8), "RGB")
    # Gentle palette reduction keeps the pixel-art character without banding.
    out = out.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"tex-{tid}.png"
    out.save(dst, optimize=True)
    return {"raw": src.name, "out": str(dst.relative_to(ROOT)), "seamScore": round(score, 2), "seamFixed": fixed}


# ------------------------------------------------------------------------------------------- props
def key_magenta(rgb: np.ndarray, strong: float = 70, loose: float = 150) -> np.ndarray:
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magentaish = (r - g > 90) & (b - g > 90)
    cand = (dist < loose) & magentaish
    lab, _ = ndimage.label(cand)
    edge_labels = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    edge_labels = edge_labels[edge_labels > 0]
    bgmask = np.isin(lab, edge_labels) | (dist < strong)
    for _ in range(2):
        opaque = ~bgmask
        near = ndimage.binary_dilation(bgmask, structure=np.ones((3, 3))) & opaque
        fringe = near & (dist < 190) & (r - g > 50) & (b - g > 50)
        bgmask |= fringe
    alpha = np.where(bgmask, 0, 255).astype(np.uint8)
    out = np.dstack([rgb.clip(0, 255).astype(np.uint8), alpha])
    out[alpha == 0, :3] = 0
    return out


def objects(rgba: np.ndarray, expected: int, min_frac: float = 0.15) -> list[np.ndarray]:
    """Groups connected components into objects ordered left to right. Small bits join the nearest big one."""
    mask = rgba[..., 3] > 0
    mask = ndimage.binary_opening(mask, structure=np.ones((3, 3)))
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return []
    idx = np.arange(1, n + 1)
    areas = ndimage.sum(mask, lab, idx)
    big = [i for i, a in zip(idx, areas) if a >= areas.max() * min_frac]
    slices = ndimage.find_objects(lab)
    groups: dict[int, np.ndarray] = {i: lab == i for i in big}
    for i, a in zip(idx, areas):
        if i in groups or a < 30:
            continue
        sl = slices[i - 1]
        cx = (sl[1].start + sl[1].stop) / 2
        cy = (sl[0].start + sl[0].stop) / 2
        best = min(big, key=lambda j: abs((slices[j - 1][1].start + slices[j - 1][1].stop) / 2 - cx)
                   + 0.5 * abs((slices[j - 1][0].start + slices[j - 1][0].stop) / 2 - cy))
        groups[best] |= lab == i
    ordered = sorted(groups.values(), key=lambda m: np.nonzero(m)[1].mean())
    if len(ordered) != expected:
        print(f"  note: found {len(ordered)} objects, expected {expected}")
    return ordered


def area_resize(img: Image.Image, size: tuple[int, int], alpha_cut: float = 0.5) -> Image.Image:
    a = np.asarray(img).astype(np.float64) / 255.0
    pre = a.copy()
    pre[..., :3] *= pre[..., 3:4]
    chans = []
    for i in range(4):
        ch = Image.fromarray((pre[..., i] * 255).astype(np.float32), "F")
        chans.append(np.asarray(ch.resize(size, Image.Resampling.BOX)))
    out = np.dstack(chans) / 255.0
    alpha = out[..., 3]
    rgb = np.where(alpha[..., None] > 1e-6, out[..., :3] / np.maximum(alpha[..., None], 1e-6), 0)
    hard = alpha >= alpha_cut
    res = np.zeros(out.shape, dtype=np.uint8)
    res[..., :3] = (rgb * 255).clip(0, 255).round().astype(np.uint8)
    res[..., 3] = np.where(hard, 255, 0)
    res[~hard, :3] = 0
    return Image.fromarray(res, "RGBA")


def darken_edges(img: Image.Image, color=OUTLINE, min_dark: int = 60) -> Image.Image:
    arr = np.asarray(img).copy()
    opaque = arr[..., 3] == 255
    inner = ndimage.binary_erosion(opaque, structure=ndimage.generate_binary_structure(2, 1), border_value=0)
    edge = opaque & ~inner
    lum = arr[..., :3].astype(int).mean(axis=2)
    sel = edge & (lum > min_dark)
    arr[sel, :3] = (arr[sel, :3] * 0.35 + np.array(color) * 0.65).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def build_prop(pid: str) -> dict:
    src = raw_path("prop", pid)
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.int32)
    rgba = key_magenta(rgb)
    expected = PROPS[pid][2] if pid in PROPS else 1
    outs = []
    PROPS_OUT.mkdir(parents=True, exist_ok=True)
    for n, m in enumerate(objects(rgba, expected)):
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        part = rgba[y0:y1, x0:x1].copy()
        part[~m[y0:y1, x0:x1]] = 0
        img = Image.fromarray(part, "RGBA")
        th, tw = PROP_HEIGHT.get(pid, 48), PROP_WIDTH.get(pid, 64)
        sc = min(th / img.height, tw / img.width)
        size = (max(1, round(img.width * sc)), max(1, round(img.height * sc)))
        small = darken_edges(area_resize(img, size))
        # Pad 1px for outline room and save.
        canvas = Image.new("RGBA", (small.width + 2, small.height + 1), (0, 0, 0, 0))
        canvas.paste(small, (1, 0))
        dst = PROPS_OUT / f"{pid}-{n}.png"
        canvas.save(dst, optimize=True)
        outs.append({"out": str(dst.relative_to(ROOT)), "w": canvas.width, "h": canvas.height})
    return {"raw": src.name, "variants": outs}


# ------------------------------------------------------------------------------------------- backdrops
def build_backdrop(bid: str) -> dict:
    src = raw_path("sky", bid)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    tw = w
    th = round(w * 9 / 16)
    if th > h:
        th = h
        tw = round(h * 16 / 9)
    top = (h - th) // 3   # keep more sky than ground
    im = im.crop(((w - tw) // 2, top, (w - tw) // 2 + tw, top + th))
    out = im.resize((640, 360), Image.Resampling.BOX)
    out = out.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / f"sky-{bid}.png"
    out.save(dst, optimize=True)
    return {"raw": src.name, "out": str(dst.relative_to(ROOT))}


def contact(kind: str) -> None:
    """2x2 tiled preview of each texture (to eyeball seams) into the raw folder."""
    files = sorted(OUT.glob("tex-*.png"))
    if not files:
        return
    tiles = []
    for f in files:
        t = Image.open(f).convert("RGB")
        big = Image.new("RGB", (TEX_SIZE * 2, TEX_SIZE * 2))
        for i in range(2):
            for j in range(2):
                big.paste(t, (i * TEX_SIZE, j * TEX_SIZE))
        tiles.append(big)
    cols = 4
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 512, rows * 512), (20, 20, 24))
    for k, t in enumerate(tiles):
        sheet.paste(t, ((k % cols) * 512, (k // cols) * 512))
    sheet.save(RAW / f"contact-{kind}.png")


def write_manifest() -> None:
    """Lists what exists for the game loader (game/public/assets/tactics/manifest.json)."""
    import re
    props: dict[str, list[dict]] = {}
    for f in sorted(PROPS_OUT.glob("iso-*.png")):
        m = re.match(r"(iso-.+)-(\d+)\.png$", f.name)
        if not m:
            continue
        img = Image.open(f)
        w, h = img.size
        a = np.asarray(img.convert("RGBA"))[..., 3] > 0
        rows = np.nonzero(a.any(axis=1))[0]
        foot = a[max(0, rows.max() - 3):rows.max() + 1]
        ax = int(round(np.nonzero(foot.any(axis=0))[0].mean())) if foot.any() else w // 2
        props.setdefault(m.group(1), []).append({"n": int(m.group(2)), "w": w, "h": h, "ax": ax})
    for v in props.values():
        v.sort(key=lambda e: e["n"])
    man = {
        "textures": sorted(f.stem[4:] for f in OUT.glob("tex-*.png")),
        "backdrops": sorted(f.stem[4:] for f in OUT.glob("sky-*.png")),
        "props": props,
    }
    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))


def main() -> None:
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    for a in sys.argv[2:]:
        if a.startswith("--pick="):
            k, v = a[7:].split("=", 1)
            PICK[k] = v
    prompts_path = RAW / "prompts.json"
    prompts = json.loads(prompts_path.read_text()) if prompts_path.exists() else {}
    DOC.parent.mkdir(parents=True, exist_ok=True)
    doc = json.loads(DOC.read_text()) if DOC.exists() else {"textures": {}, "props": {}, "backdrops": {}}
    if what in ("textures", "all"):
        for tid in TEXTURES:
            if not raw_path("tex", tid).exists():
                continue
            info = build_texture(tid)
            info.update(prompts.get(info["raw"], {}))
            doc["textures"][tid] = info
            print("texture", tid, info["seamScore"], "fixed" if info["seamFixed"] else "")
        contact("textures")
    if what in ("props", "all"):
        for pid in PROPS:
            if not raw_path("prop", pid).exists():
                continue
            info = build_prop(pid)
            info.update(prompts.get(info["raw"], {}))
            doc["props"][pid] = info
            print("prop", pid, [v["w"] for v in info["variants"]])
    if what in ("backdrops", "all"):
        for bid in BACKDROPS:
            if not raw_path("sky", bid).exists():
                continue
            info = build_backdrop(bid)
            info.update(prompts.get(info["raw"], {}))
            doc["backdrops"][bid] = info
            print("backdrop", bid)
    DOC.write_text(json.dumps(doc, indent=2, ensure_ascii=False))
    write_manifest()


if __name__ == "__main__":
    main()

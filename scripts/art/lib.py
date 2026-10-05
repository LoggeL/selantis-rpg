#!/usr/bin/env python3
"""Shared image helpers for the Selantis art pipeline (Pillow + NumPy + SciPy only).

Everything here is *technical* post-processing of Codex images — no hand-painted pixels:
magenta keying with despill, figure detection, area downscaling with hard alpha, outline darkening,
shared palettes, foot-anchored placement, sanity checks. Used by characters.py, props.py, icons.py,
backgrounds.py, plates.py and qa.py.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "game/public"
ASSETS = PUBLIC / "assets"
RAW_ROOT = ROOT / "output/imagegen/raw"
PREVIEW = ROOT / "output/imagegen/preview"
STYLE_REFS = ROOT / "output/imagegen/style-refs"
DOCS_ART = ROOT / "docs/rebuild/art"
OUTLINE = (30, 20, 24)


def rel(path: Path | str) -> str:
    p = Path(path)
    try:
        return str(p.resolve().relative_to(ROOT))
    except ValueError:
        return str(p)


def sha(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]


def load_json(path: Path, default):
    try:
        return json.loads(Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


# ---------------------------------------------------------------------------------------------- keying

def background_color(rgb: np.ndarray) -> np.ndarray:
    """Median of the border pixels (Codex returns ≈ (251,3,251) rather than pure #FF00FF)."""
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    return np.median(border, axis=0)


def key_out(image: Image.Image, strong: float = 70, loose: float = 160, min_area: int = 40,
            despill: bool = True) -> Image.Image:
    """Magenta background → RGBA with hard alpha (0/255).

    1. Flood fill from the border over magenta-ish pixels closer than `loose` to the background colour.
    2. Additionally every pixel closer than `strong` (enclosed gaps, e.g. between arm and body).
    3. Two passes remove magenta fringes along the silhouette.
    4. Despill: remaining edge pixels with a magenta cast get their red/blue pulled towards green.
    5. Specks smaller than `min_area` are removed.
    """
    rgb = np.asarray(image.convert("RGB")).astype(np.int32)
    bg = background_color(rgb)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magentaish = (r - g > 70) & (b - g > 70)
    cand = (dist < loose) & magentaish
    lab, _ = ndimage.label(cand)
    edge_labels = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    edge_labels = edge_labels[edge_labels > 0]
    bgmask = np.isin(lab, edge_labels) | (dist < strong)
    for _ in range(2):
        opaque = ~bgmask
        near = ndimage.binary_dilation(bgmask, structure=np.ones((3, 3))) & opaque
        fringe = near & (dist < 200) & (r - g > 45) & (b - g > 45)
        bgmask |= fringe
    alpha = ~bgmask
    lab2, n = ndimage.label(alpha, structure=np.ones((3, 3)))
    if n:
        sizes = ndimage.sum(alpha, lab2, np.arange(1, n + 1))
        small = np.isin(lab2, np.nonzero(sizes < min_area)[0] + 1)
        alpha &= ~small
    out = rgb.copy()
    if despill:
        edge = alpha & ndimage.binary_dilation(~alpha, structure=np.ones((5, 5)))
        spill = edge & (np.minimum(r, b) - g > 20)
        excess = (np.minimum(r, b) - g)[spill]
        out[spill, 0] = r[spill] - excess * 0.6
        out[spill, 2] = b[spill] - excess * 0.6
    res = np.dstack([out.clip(0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
    res[~alpha, :3] = 0
    return Image.fromarray(res, "RGBA")


# ------------------------------------------------------------------------------------------- detection

def alpha_mask(img: Image.Image) -> np.ndarray:
    return np.asarray(img.getchannel("A")) > 0


def blobs(img: Image.Image, min_area: int = 200, join: int = 6) -> list[dict]:
    """Figure candidates: connected components after a small dilation (so hair strands, a dangling rope
    or a separated hand stay with their figure). Returns dicts with bbox (x0,y0,x1,y1), area, mask, cx, cy."""
    mask = alpha_mask(img)
    grown = ndimage.binary_dilation(mask, structure=np.ones((3, 3)), iterations=join) if join else mask
    lab, n = ndimage.label(grown, structure=np.ones((3, 3)))
    out = []
    for i in range(1, n + 1):
        m = (lab == i) & mask
        area = int(m.sum())
        if area < min_area:
            continue
        ys, xs = np.nonzero(m)
        out.append({"bbox": (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1), "area": area,
                    "mask": m, "cx": float(xs.mean()), "cy": float(ys.mean())})
    return out


def crop_blob(img: Image.Image, blob: dict) -> Image.Image:
    x0, y0, x1, y1 = blob["bbox"]
    arr = np.asarray(img).copy()
    arr[~blob["mask"]] = 0
    return Image.fromarray(arr[y0:y1, x0:x1], "RGBA")


def merge_blobs(group: list[dict]) -> dict:
    mask = np.zeros_like(group[0]["mask"])
    for b in group:
        mask |= b["mask"]
    ys, xs = np.nonzero(mask)
    return {"bbox": (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1), "area": int(mask.sum()),
            "mask": mask, "cx": float(xs.mean()), "cy": float(ys.mean())}


def cluster_1d(values: list[float], k: int) -> list[int]:
    """Assigns each value to one of k clusters along one axis by splitting at the k-1 largest gaps."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    if k <= 1 or len(values) <= k:
        labels = [0] * len(values)
        for rank, i in enumerate(order):
            labels[i] = min(rank, k - 1)
        return labels
    sv = [values[i] for i in order]
    gaps = sorted(range(len(sv) - 1), key=lambda i: sv[i + 1] - sv[i], reverse=True)[: k - 1]
    cuts = sorted(gaps)
    labels = [0] * len(values)
    c = 0
    for rank, i in enumerate(order):
        labels[i] = c
        if c < len(cuts) and rank == cuts[c]:
            c += 1
    return labels


def grid_figures(img: Image.Image, rows: int, cols: int, min_area: int = 300) -> list[list[Image.Image]]:
    """Finds a rows×cols grid of figures. Small blobs (detached hands, hair, dust) are attached to the
    nearest large figure. Rows are found by clustering centre-y, columns per row by centre-x."""
    found = blobs(img, min_area=min_area // 4)
    if not found:
        raise ValueError("no figures found")
    found.sort(key=lambda b: -b["area"])
    big_cut = found[min(len(found), rows * cols) - 1]["area"] * 0.35
    big = [b for b in found if b["area"] >= big_cut]
    small = [b for b in found if b["area"] < big_cut]
    if len(big) < rows * cols:
        raise ValueError(f"expected {rows * cols} figures, found {len(big)} large blobs")
    # If more large blobs than cells: merge the closest pairs (figure split in two by a gap).
    while len(big) > rows * cols:
        best = None
        for i in range(len(big)):
            for j in range(i + 1, len(big)):
                d = _bbox_gap(big[i]["bbox"], big[j]["bbox"])
                if best is None or d < best[0]:
                    best = (d, i, j)
        _, i, j = best
        big[i] = merge_blobs([big[i], big[j]])
        del big[j]
    groups = [[b] for b in big]
    for s in small:
        k = min(range(len(big)), key=lambda i: _bbox_gap(big[i]["bbox"], s["bbox"]))
        if _bbox_gap(big[k]["bbox"], s["bbox"]) < 40:
            groups[k].append(s)
    figs = [merge_blobs(g) for g in groups]
    row_of = cluster_1d([f["cy"] for f in figs], rows)
    grid: list[list[Image.Image]] = []
    for r in range(rows):
        members = [f for f, lr in zip(figs, row_of) if lr == r]
        if len(members) != cols:
            raise ValueError(f"row {r + 1}: expected {cols} figures, found {len(members)}")
        members.sort(key=lambda f: f["cx"])
        grid.append([crop_blob(img, f) for f in members])
    return grid


def _bbox_gap(a, b) -> float:
    dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
    return float(np.hypot(dx, dy))


def split_columns(img: Image.Image, parts: int) -> list[Image.Image]:
    """Splits an image horizontally into `parts` figure groups at the widest empty column gaps."""
    found = blobs(img, min_area=150)
    if len(found) < parts:
        raise ValueError(f"expected {parts} figures, found {len(found)}")
    labels = cluster_1d([b["cx"] for b in found], parts)
    out = []
    for p in range(parts):
        group = [b for b, lab in zip(found, labels) if lab == p]
        out.append((min(b["bbox"][0] for b in group), crop_blob(img, merge_blobs(group))))
    return [im for _, im in sorted(out, key=lambda t: t[0])]


def largest_figure(img: Image.Image) -> Image.Image:
    found = blobs(img, min_area=100)
    if not found:
        raise ValueError("empty image")
    top = max(b["area"] for b in found)
    keep = [b for b in found if b["area"] >= top * 0.02]
    return crop_blob(img, merge_blobs(keep))


# ------------------------------------------------------------------------------------------- resizing

def area_resize(img: Image.Image, size: tuple[int, int], alpha_cut: float = 0.45) -> Image.Image:
    """Area-average downscale with premultiplied alpha → hard alpha, no colour fringes."""
    a = np.asarray(img.convert("RGBA")).astype(np.float64) / 255.0
    pre = a.copy()
    pre[..., :3] *= pre[..., 3:4]
    chans = [np.asarray(Image.fromarray(pre[..., i].astype(np.float32), "F").resize(size, Image.Resampling.BOX))
             for i in range(4)]
    out = np.dstack(chans)
    alpha = out[..., 3]
    rgb = np.where(alpha[..., None] > 1e-6, out[..., :3] / np.maximum(alpha[..., None], 1e-6), 0)
    hard = alpha >= alpha_cut
    res = np.zeros(out.shape, dtype=np.uint8)
    res[..., :3] = (rgb * 255).clip(0, 255).round().astype(np.uint8)
    res[..., 3] = np.where(hard, 255, 0)
    res[~hard, :3] = 0
    return Image.fromarray(res, "RGBA")


def scale_to(img: Image.Image, scale: float, alpha_cut: float = 0.45) -> Image.Image:
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    small = area_resize(img, (w, h), alpha_cut)
    box = small.getchannel("A").getbbox()
    return small.crop(box) if box else small


def sharpen(img: Image.Image, percent: int = 60) -> Image.Image:
    arr = np.asarray(img.convert("RGBA")).copy()
    rgb = Image.fromarray(arr[..., :3], "RGB").filter(ImageFilter.UnsharpMask(radius=1, percent=percent, threshold=2))
    out = np.dstack([np.asarray(rgb), arr[..., 3]])
    out[arr[..., 3] == 0, :3] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def darken_outline(img: Image.Image, factor: float = 0.45, tint=OUTLINE) -> Image.Image:
    """Darkens the outermost silhouette pixels (replaces the dark contour lost when shrinking)."""
    arr = np.asarray(img).astype(np.float32).copy()
    a = arr[..., 3] > 0
    inner = ndimage.binary_erosion(a, structure=ndimage.generate_binary_structure(2, 1), border_value=0)
    edge = a & ~inner
    lum = arr[..., :3].mean(axis=2)
    target = edge & (lum > 50)
    arr[target, :3] = arr[target, :3] * factor + np.array(tint) * (1 - factor)
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGBA")


def add_outline(img: Image.Image, color=OUTLINE, pad: int = 1) -> Image.Image:
    """Outer 1-px contour (image grows by `pad` on each side)."""
    arr = np.asarray(img)
    h, w = arr.shape[:2]
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 4), dtype=np.uint8)
    canvas[pad:pad + h, pad:pad + w] = arr
    opaque = canvas[..., 3] == 255
    ring = ndimage.binary_dilation(opaque, structure=ndimage.generate_binary_structure(2, 1)) & ~opaque
    canvas[ring] = (*color, 255)
    return Image.fromarray(canvas, "RGBA")


def make_palette(frames: list[Image.Image], colors: int = 40, base: int = 30, min_count: int = 4,
                 min_dist: float = 38.0) -> Image.Image:
    """Shared palette: median-cut base plus rare but clearly different colours (so small features such as
    a turquoise glow, a red ribbon or a blood stain survive)."""
    px = []
    for f in frames:
        arr = np.asarray(f.convert("RGBA"))
        px.append(arr[arr[..., 3] > 0][:, :3])
    data = np.concatenate(px).astype(np.uint8)
    strip = Image.fromarray(data.reshape(1, -1, 3), "RGB")
    mc = strip.quantize(colors=base, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(mc.getpalette()[: base * 3], dtype=np.float32).reshape(-1, 3)
    pal = pal[np.unique(np.asarray(mc))]
    keys = (data[:, 0].astype(np.int32) >> 4) * 256 + (data[:, 1].astype(np.int32) >> 4) * 16 + (data[:, 2] >> 4)
    uniq, inv, counts = np.unique(keys, return_inverse=True, return_counts=True)
    sums = np.zeros((len(uniq), 3))
    np.add.at(sums, inv, data.astype(np.float64))
    cand = (sums / counts[:, None]).astype(np.float32)[counts >= min_count]
    while len(pal) < colors and len(cand):
        d = np.sqrt(((cand[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)).min(axis=1)
        i = int(np.argmax(d))
        if d[i] < min_dist:
            break
        pal = np.vstack([pal, cand[i]])
    flat = [int(round(v)) for v in pal.flatten()]
    flat += flat[-3:] * (256 - len(pal))
    out = Image.new("P", (1, 1))
    out.putpalette(flat)
    return out


def apply_palette(frame: Image.Image, palette: Image.Image) -> Image.Image:
    alpha = frame.getchannel("A")
    out = frame.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE).convert("RGBA")
    out.putalpha(alpha)
    arr = np.asarray(out).copy()
    arr[arr[..., 3] == 0] = 0
    return Image.fromarray(arr, "RGBA")


# --------------------------------------------------------------------------------------------- anchors

def band_center(img: Image.Image, top: float, bottom: float) -> float:
    """Mass centroid x of the opaque pixels between the relative heights top..bottom."""
    a = alpha_mask(img)
    h = a.shape[0]
    y0, y1 = int(h * top), max(int(h * top) + 1, int(h * bottom))
    ys, xs = np.nonzero(a[y0:y1])
    return float(xs.mean()) if len(xs) else img.width / 2


def foot_center(img: Image.Image, rows: int = 3) -> float:
    a = alpha_mask(img)
    centers = []
    for y in range(max(0, a.shape[0] - rows), a.shape[0]):
        xs = np.nonzero(a[y])[0]
        if len(xs):
            centers.append((xs[0] + xs[-1]) / 2)
    return float(median(centers)) if centers else img.width / 2


def place(small: Image.Image, cell: tuple[int, int], anchor_x: float, foot: tuple[int, int], name: str,
          strict: bool = True) -> Image.Image:
    """Puts `small` into a transparent cell so column `anchor_x` lands on foot.x and its bottom on foot.y."""
    fw, fh = cell
    x = round(foot[0] - anchor_x)
    y = foot[1] - small.height
    if strict and (x < 0 or y < 0 or x + small.width > fw or y + small.height > fh):
        raise ValueError(f"{name}: does not fit the {fw}x{fh} cell (x={x}, y={y}, size={small.size})")
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    frame.alpha_composite(small, (max(0, x), max(0, y)) if not strict else (x, y))
    return frame


def check_alpha(img: Image.Image, name: str) -> None:
    arr = np.asarray(img.convert("RGBA"))
    a = arr[..., 3]
    if not np.isin(a, (0, 255)).all():
        raise ValueError(f"{name}: alpha is not hard")
    r, g, b = (arr[..., i].astype(int) for i in range(3))
    magenta = (a == 255) & (np.minimum(r, b) - g > 110)
    if magenta.sum() > 3:
        raise ValueError(f"{name}: {int(magenta.sum())} magenta pixels left")


# ------------------------------------------------------------------------------------------ framing

def crop_16_9(im: Image.Image, focus_y: float = 0.5, focus_x: float = 0.5) -> Image.Image:
    w, h = im.size
    if w * 9 > h * 16:
        nw = round(h * 16 / 9)
        x0 = round((w - nw) * focus_x)
        return im.crop((x0, 0, x0 + nw, h))
    nh = round(w * 9 / 16)
    y0 = round((h - nh) * focus_y)
    return im.crop((0, y0, w, y0 + nh))


def on_color(img: Image.Image, color, scale: int = 1) -> Image.Image:
    bg = Image.new("RGBA", img.size, color)
    bg.alpha_composite(img.convert("RGBA"))
    return bg.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST) if scale != 1 else bg


def checker(size, a=(74, 78, 86), b=(96, 100, 108), step=8) -> Image.Image:
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    m = ((xx // step + yy // step) % 2).astype(bool)
    arr = np.where(m[..., None], np.array(b), np.array(a)).astype(np.uint8)
    return Image.fromarray(np.dstack([arr, np.full((h, w), 255, np.uint8)]), "RGBA")

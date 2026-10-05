#!/usr/bin/env python3
"""Renders a map report of scripts/map_tool.mjs: background + geometry + labels.

  python3 scripts/map/overlay.py output/qa/maps/<id>.json output/qa/maps/<id>.png

Colours: walk green, holes/blocks red (dashed = see-through), occluders violet with baseline, surfaces brown,
hiding spots yellow, triggers blue, exits cyan, interactables white, clues turquoise, spawns green, NPCs pink,
guard paths orange, lights gold. Walkable area the player cannot reach is tinted red.
"""
from __future__ import annotations

import base64
import json
import sys

from PIL import Image, ImageDraw, ImageFont


def main(src: str, out: str) -> None:
    rep = json.load(open(src))
    w, h = rep["size"]
    scale = 2 if w <= 800 else 1
    if rep.get("bg"):
        base = Image.open(rep["bg"]).convert("RGB").resize((w, h), Image.NEAREST)
    else:
        base = Image.new("RGB", (w, h), (30, 30, 30))
    base = base.resize((w * scale, h * scale), Image.NEAREST).convert("RGBA")

    # Unreachable walkable cells (red tint) and blocked cells (dark veil).
    cell, cols, rows = rep["cell"], rep["cols"], rep["rows"]
    reach = base64.b64decode(rep["reach"])
    walk = base64.b64decode(rep["walkMask"])
    veil = Image.new("RGBA", base.size, (0, 0, 0, 0))
    dv = ImageDraw.Draw(veil)
    s = cell * scale
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            if not walk[i]:
                dv.rectangle([c * s, r * s, c * s + s - 1, r * s + s - 1], fill=(0, 0, 0, 70))
            elif not reach[i]:
                dv.rectangle([c * s, r * s, c * s + s - 1, r * s + s - 1], fill=(255, 0, 0, 90))
    img = Image.alpha_composite(base, veil)

    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 11 * scale if scale > 1 else 12)
    except OSError:
        font = ImageFont.load_default()

    S = lambda p: (p[0] * scale, p[1] * scale)

    def poly(pts, color, fill=None, dashed=False, width=2):
        if not pts or len(pts) < 2:
            return
        P = [S(p) for p in pts]
        if fill:
            d.polygon(P, fill=fill)
        if dashed:
            for a, b in zip(P, P[1:] + P[:1]):
                n = max(1, int(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5 / 6))
                for k in range(0, n, 2):
                    t0, t1 = k / n, min(1, (k + 1) / n)
                    d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill=color, width=width)
        else:
            d.line(P + [P[0]], fill=color, width=width)

    def label(p, text, color):
        x, y = S(p)
        d.text((x + 3, y - 14), text, fill=color, font=font, stroke_width=2, stroke_fill=(0, 0, 0, 230))

    def dot(p, color, r=3):
        x, y = S(p)
        d.ellipse([x - r * scale, y - r * scale, x + r * scale, y + r * scale], fill=color)

    def bounds(pts):
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return min(xs), min(ys), max(xs), max(ys)

    g = rep["geometry"]
    for wa in g["walk"]:
        poly(wa["poly"], (90, 240, 120, 255), (90, 240, 120, 25))
        for hole in wa.get("holes") or []:
            poly(hole, (255, 80, 60, 255), (255, 80, 60, 40))
    for b in g["block"]:
        poly(b["poly"], (255, 70, 50, 255), (255, 70, 50, 45), dashed=b.get("sight") is False)
        x0, y0, x1, y1 = bounds(b["poly"])
        label(((x0 + x1) / 2 - 10, (y0 + y1) / 2 + 6), b.get("id") or "block", (255, 160, 140, 255))
    for s_ in g["surfaces"]:
        poly(s_["poly"], (230, 170, 90, 255), dashed=True, width=1)
        x0, y0, _, _ = bounds(s_["poly"])
        label((x0 + 2, y0 + 14), f"{s_.get('id') or 'Fläche'}: {s_['kind']}", (240, 200, 140, 255))
    for o in g["occluders"]:
        poly(o["poly"], (190, 120, 255, 255), (190, 120, 255, 30))
        x0, _, x1, _ = bounds(o["poly"])
        d.line([S((x0, o["baseline"])), S((x1, o["baseline"]))], fill=(255, 140, 255, 255), width=2)
        label((x0, o["baseline"]), f"{o.get('id') or 'Verdecker'} ({o['baseline']})", (255, 180, 255, 255))
    for hs in g["hiding"]:
        if hs["poly"]:
            poly(hs["poly"], (255, 215, 60, 255), (255, 215, 60, 40))
            x0, y0, _, _ = bounds(hs["poly"])
            label((x0, y0 + 10), f"Versteck {hs.get('id') or ''}", (255, 225, 110, 255))
    for t in g["triggers"]:
        if t["poly"]:
            poly(t["poly"], (80, 150, 255, 255), (80, 150, 255, 40))
            x0, y0, _, _ = bounds(t["poly"])
            label((x0, y0 + 10), f"Trigger {t['id']}", (150, 190, 255, 255))
    for e in g["exits"]:
        if e["poly"]:
            poly(e["poly"], (60, 230, 230, 255), (60, 230, 230, 60))
            x0, y0, _, _ = bounds(e["poly"])
            label((x0 - 60, y0 + 10), f"{e['id']} → {e['to']}{':' + e['spawn'] if e['spawn'] else ''}", (140, 255, 255, 255))
        if e["door"]:
            dot(e["door"], (140, 255, 255, 255))
    for it in g["interactables"]:
        if it["poly"]:
            poly(it["poly"], (255, 255, 255, 255), (255, 255, 255, 30))
            x0, y0, x1, y1 = bounds(it["poly"])
            at = it["at"] or [(x0 + x1) / 2, y1]
        else:
            at = it["at"]
            if at:
                r = it["radius"] * scale
                x, y = S(at)
                d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255, 200), width=1)
        if at:
            dot(at, (255, 255, 255, 255))
            label(at, f"{it['id']}" + (f" „{it['verb']}“" if it.get("verb") else ""), (255, 255, 255, 255))
        if it.get("standAt"):
            dot(it["standAt"], (200, 140, 255, 255))
    for c in g["clues"]:
        dot(c["at"], (73, 224, 200, 255))
        label(c["at"], c["id"], (120, 240, 220, 255))
    for l in g["lights"]:
        x, y = S(l["at"])
        r = l["radius"] * scale
        d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 220, 120, 160), width=1)
        label(l["at"], f"Licht {l.get('id') or ''}", (255, 225, 160, 255))
    for gd in g["guards"]:
        pts = [S(p) for p in gd["path"]]
        if len(pts) > 1:
            d.line(pts + ([pts[0]] if gd["mode"] != "pingpong" and len(pts) > 2 else []), fill=(255, 160, 60, 255), width=2)
        for i, p in enumerate(gd["path"]):
            dot(p, (255, 170, 70, 255))
            label(p, f"Wache {gd['id']}" if i == 0 else str(i), (255, 200, 140, 255))
    for n in g["npcs"]:
        dot(n["at"], (255, 120, 255, 255), 4)
        label(n["at"], f"NPC {n['id']}", (255, 180, 255, 255))
    for p in g["props"]:
        dot(p["at"], (200, 200, 200, 255), 2)
    for name, sp in g["spawns"].items():
        dot(sp["at"], (90, 255, 90, 255), 4)
        dx, dy = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}[sp["dir"]]
        x, y = S(sp["at"])
        d.line([(x, y), (x + dx * 12 * scale, y + dy * 12 * scale)], fill=(90, 255, 90, 255), width=2)
        label((sp["at"][0], sp["at"][1] + 14), f"Start {name}", (140, 255, 140, 255))

    img = Image.alpha_composite(img, layer)
    if rep["problems"]:
        d2 = ImageDraw.Draw(img)
        text = "\n".join(["Probleme:"] + [f"- {p}" for p in rep["problems"]])
        d2.multiline_text((8, 8), text, fill=(255, 120, 100, 255), font=font, stroke_width=2, stroke_fill=(0, 0, 0, 255))
    img.convert("RGB").save(out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

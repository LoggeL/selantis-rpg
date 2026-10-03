#!/usr/bin/env python3
"""Baut die Laufzeit-Assets des Prologs aus den generierten Rohbildern.

Rohbilder: output/imagegen/raw/<id>/...
Ausgabe:   game/public/assets/{bg,cut,portraits,sprites,ui}/ + game/public/assets/manifest.json

Figuren werden pro Figur einheitlich skaliert (Stehhöhe aus Referenzframes), auf 64x64-Frames
mit festem Fußpunkt gesetzt, farbreduziert und mit dunkler 1px-Kontur versehen.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "output/imagegen/raw"
OUT = ROOT / "game/public/assets"

FRAME = 64
FOOT_Y = 60
OUTLINE = (24, 20, 22, 255)

# id, Quelldatei, cols, rows, optionale Zellgrenzen
SHEETS = {
    "valentus-walk": ("spr-valentus-robe/spr-valentus-robe-walk.png", 4, 4),
    "valentus-cast": ("spr-valentus-robe/spr-valentus-robe-cast.png", 4, 4),
    "valentus-cloak-run": ("spr-valentus-cloak/spr-valentus-cloak-run.png", 4, 4),
    "valentus-cloak-events": ("spr-valentus-cloak/spr-valentus-cloak-events.png", 4, 3),
    "valentus-refuge": ("spr-valentus-refuge/spr-valentus-refuge.png", 4, 3),
    "warrior": ("spr-ds-warrior/spr-ds-warrior.png", 4, 4),
    "axe": ("spr-ds-axe/spr-ds-axe.png", 4, 4),
    "crossbow": ("spr-ds-crossbow/spr-ds-crossbow.png", 4, 3),
    "boy": ("spr-boy/spr-boy.png", 4, 4),
    "falke": ("spr-falke/spr-falke.png", 4, 3),
    "woman": ("spr-woman/spr-woman.png", 4, 2),
    "lia-read": ("spr-lia/spr-lia-read.png", 4, 2),
    "lia-walk": ("spr-lia/spr-lia-walk.png", 4, 4),
}
CROSSBOW_BOUNDS = {"x": [0, 296, 591, 886, 1182], "y": [0, 443, 887, 1330]}

# Figur -> (Sheets, Referenzframes für Stehhöhe als (sheet, index), Zielhöhe in px)
FIGURES = {
    "valentus": (["valentus-walk", "valentus-cast"], [("valentus-walk", i) for i in range(16)], 44),
    "valentus-cloak": (["valentus-cloak-run"], [("valentus-cloak-run", i) for i in range(16)], 40),
    "valentus-cloak-ev": (["valentus-cloak-events"], [("valentus-cloak-events", 3), ("valentus-cloak-events", 7)], 38),
    "valentus-refuge": (["valentus-refuge"], [("valentus-refuge", i) for i in range(4, 8)], 40),
    "warrior": (["warrior"], [("warrior", i) for i in range(8, 12)], 42),
    "axe": (["axe"], [("axe", i) for i in range(12, 16)], 43),
    "crossbow": (["crossbow"], [("crossbow", i) for i in range(4, 8)], 40),
    "boy": (["boy"], [("boy", 14), ("boy", 15)], 37),
    "falke": (["falke"], [("falke", 8), ("falke", 9)], 41),
    "woman": (["woman"], [("woman", 0), ("woman", 1)], 41),
    "lia": (["lia-read", "lia-walk"], [("lia-walk", i) for i in range(16)], 37),
}


def chroma_key(im: Image.Image) -> Image.Image:
    """Entfernt Magenta-Hintergründe (auch opakes Magenta in RGBA-Bildern) und rechnet Magenta-Säume heraus."""
    a = np.array(im.convert("RGBA")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)
    a[bg] = 0
    fringe = ~bg & (r > 120) & (b > 120) & (g < r * 0.6) & (g < b * 0.6)
    m = np.minimum(r, b) - g
    a[..., 0] = np.where(fringe, np.maximum(0, r - m), a[..., 0])
    a[..., 2] = np.where(fringe, np.maximum(0, b - m), a[..., 2])
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")


def cells(im, cols, rows, bounds=None):
    w, h = im.size
    xs = bounds["x"] if bounds else [round(i * w / cols) for i in range(cols + 1)]
    ys = bounds["y"] if bounds else [round(i * h / rows) for i in range(rows + 1)]
    return [im.crop((xs[c], ys[r], xs[c + 1], ys[r + 1])) for r in range(rows) for c in range(cols)]


def alpha_bbox(cell):
    a = cell.getchannel("A").point(lambda v: 255 if v > 100 else 0)
    return a.getbbox()


def body_center_x(cell, bbox):
    """Horizontaler Körperschwerpunkt aus dem Rumpfbereich, damit ausgestreckte Arme nicht verschieben."""
    x0, y0, x1, y1 = bbox
    h = y1 - y0
    a = cell.getchannel("A")
    xs = []
    for y in range(y0 + int(h * 0.2), y0 + int(h * 0.65)):
        row = [x for x in range(x0, x1) if a.getpixel((x, y)) > 100]
        if row:
            xs.append((row[0] + row[-1]) / 2)
    xs.sort()
    return xs[len(xs) // 2] if xs else (x0 + x1) / 2


def add_outline(frame):
    a = frame.getchannel("A")
    grown = a.filter(ImageFilter.MaxFilter(3))
    out = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    ring = Image.eval(grown, lambda v: v).point(lambda v: 255 if v > 0 else 0)
    out.paste(Image.new("RGBA", frame.size, OUTLINE), mask=ring)
    out.alpha_composite(frame)
    return out


def build_sprites(manifest):
    raw_cells = {}
    for sid, (src, cols, rows) in SHEETS.items():
        if not (RAW / src).exists():
            continue  # Rohbild fehlt: bestehendes Laufzeit-Asset bleibt unverändert
        im = chroma_key(Image.open(RAW / src))
        raw_cells[sid] = (cells(im, cols, rows, CROSSBOW_BOUNDS if sid == "crossbow" else None), cols, rows)

    for fig, (sheets, refs, target_h) in FIGURES.items():
        if not all(sid in raw_cells for sid in sheets):
            continue
        heights = []
        for sid, idx in refs:
            bb = alpha_bbox(raw_cells[sid][0][idx])
            if bb:
                heights.append(bb[3] - bb[1])
        heights.sort()
        scale = target_h / heights[len(heights) // 2]
        for sid in sheets:
            cl, cols, rows = raw_cells[sid]
            sheet = Image.new("RGBA", (FRAME * cols, FRAME * rows), (0, 0, 0, 0))
            for i, cell in enumerate(cl):
                bb = alpha_bbox(cell)
                if not bb:
                    continue
                cx = body_center_x(cell, bb)
                crop = cell.crop(bb)
                nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
                small = crop.resize((nw, nh), Image.LANCZOS)
                alpha = small.getchannel("A").point(lambda v: 255 if v > 110 else 0)
                small.putalpha(alpha)
                fx = round(FRAME / 2 - (cx - bb[0]) * scale)
                fy = FOOT_Y - nh
                frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
                frame.paste(small, (fx, fy), small)
                frame = add_outline(frame)
                sheet.alpha_composite(frame, ((i % cols) * FRAME, (i // cols) * FRAME))
            # Farbreduktion ohne Dithering, Alpha erhalten
            alpha = sheet.getchannel("A")
            q = sheet.convert("RGB").quantize(colors=48, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
            q.putalpha(alpha)
            out = OUT / "sprites" / f"{sid}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            q.save(out)
            manifest["sprites"][sid] = {"file": f"assets/sprites/{sid}.png", "frameW": FRAME, "frameH": FRAME,
                                        "cols": cols, "rows": rows, "foot": [FRAME // 2, FOOT_Y], "scale": round(scale, 4)}


# Tiere: id -> (Quelle, cols, rows, Zielhöhe des Tiers in px). Frames 32x32, Fußpunkt (16, 29).
CRITTERS = {
    "crt-butterfly": ("crt-butterfly/crt-butterfly.png", 4, 2, 7),
    "crt-bird": ("crt-bird/crt-bird.png", 4, 2, 8),
    "crt-hare": ("crt-hare/crt-hare.png", 4, 2, 13),
    "crt-chicken": ("crt-chicken/crt-chicken.png", 4, 2, 12),
    "crt-pig": ("crt-pig/crt-pig.png", 4, 2, 15),
    "crt-fledgling": ("crt-fledgling/crt-fledgling.png", 4, 1, 8),
}


def build_critters(manifest):
    F, FOOT = 32, 29
    for sid, (src, cols, rows, target_h) in CRITTERS.items():
        if not (RAW / src).exists():
            continue
        cl = cells(chroma_key(Image.open(RAW / src)), cols, rows)
        hs = sorted(bb[3] - bb[1] for bb in (alpha_bbox(c) for c in cl) if bb)
        scale = target_h / hs[len(hs) // 2]
        sheet = Image.new("RGBA", (F * cols, F * rows), (0, 0, 0, 0))
        for i, cell in enumerate(cl):
            bb = alpha_bbox(cell)
            if not bb:
                continue
            crop = cell.crop(bb)
            nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
            small = crop.resize((nw, nh), Image.LANCZOS)
            small.putalpha(small.getchannel("A").point(lambda v: 255 if v > 110 else 0))
            frame = Image.new("RGBA", (F, F), (0, 0, 0, 0))
            frame.paste(small, (round(F / 2 - nw / 2), FOOT - nh), small)
            frame = add_outline(frame)
            sheet.alpha_composite(frame, ((i % cols) * F, (i // cols) * F))
        out = OUT / "sprites" / f"{sid}.png"
        sheet.save(out)
        manifest["sprites"][sid] = {"file": f"assets/sprites/{sid}.png", "frameW": F, "frameH": F, "cols": cols, "rows": rows, "foot": [16, FOOT]}


def build_items(manifest):
    src = RAW / "ui-items/ui-items.png"
    if not src.exists():
        return
    sheet = Image.new("RGBA", (16 * 8, 16), (0, 0, 0, 0))
    for i, cell in enumerate(cells(chroma_key(Image.open(src)), 4, 2)):
        bb = alpha_bbox(cell)
        c = cell.crop(bb) if bb else cell
        side = max(c.width, c.height)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.alpha_composite(c, ((side - c.width) // 2, (side - c.height) // 2))
        small = sq.resize((14, 14), Image.LANCZOS)
        small.putalpha(small.getchannel("A").point(lambda v: 255 if v > 110 else 0))
        fr = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        fr.paste(small, (1, 1), small)
        sheet.alpha_composite(add_outline(fr), (16 * i, 0))
    sheet.save(OUT / "ui/items.png")
    manifest["items"] = {"file": "assets/ui/items.png", "size": 16}


def build_flat(manifest):
    def fit(src, size, colors):
        im = Image.open(RAW / src).convert("RGB")
        tw, th = size
        r = max(tw / im.width, th / im.height)
        im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
        l, t = (im.width - tw) // 2, (im.height - th) // 2
        im = im.crop((l, t, l + tw, t + th))
        return im.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")

    jobs = {
        "bg/battle.png": ("bg-battle-ridge/bg-battle-ridge.png", (640, 360), 64),
        "bg/flight-a.png": ("bg-flight-a/bg-flight-a.png", (640, 360), 48),
        "bg/flight-b.png": ("bg-flight-b/bg-flight-b.png", (640, 360), 48),
        "bg/refuge-candle.png": ("bg-refuge-room/bg-refuge-room-candle.png", (640, 360), 48),
        "bg/refuge-dark.png": ("bg-refuge-room/bg-refuge-room-dark.png", (640, 360), 40),
        "bg/lia.png": ("bg-lia-meadow/bg-lia-meadow.png", (640, 360), 64),
        "cut/wound.png": ("cut-wound/cut-wound.png", (640, 360), 48),
        "cut/woman.png": ("cut-woman-face/cut-woman-face.png", (640, 360), 64),
        "cut/cradle-sleep.png": ("cut-cradle/cut-cradle-sleep.png", (640, 360), 48),
        "cut/cradle-empty.png": ("cut-cradle/cut-cradle-empty.png", (640, 360), 48),
        "portraits/valentus.png": ("por-valentus/por-valentus.png", (48, 48), 48),
        "portraits/valentus-wounded.png": ("por-valentus/por-valentus-wounded.png", (48, 48), 48),
        "portraits/boy.png": ("por-boy/por-boy.png", (48, 48), 48),
        "portraits/woman.png": ("por-woman/por-woman.png", (48, 48), 48),
        "portraits/lia.png": ("por-lia/por-lia.png", (48, 48), 48),
    }
    for mid in ["map-waldrand", "map-felder", "map-hohlweg", "map-hof", "map-hof-open"]:
        src = f"{mid.replace('-open', '')}/{mid}.png"
        if (RAW / src).exists():
            jobs[f"bg/{mid}.png"] = (src, (640, 360), 64)
    for out, (src, size, colors) in jobs.items():
        if not (RAW / src).exists():
            continue
        p = OUT / out
        p.parent.mkdir(parents=True, exist_ok=True)
        fit(src, size, colors).save(p)
        prefix = {"bg": "bg-", "cut": "cut-", "portraits": "portrait-"}[out.split("/")[0]]
        manifest["images"][prefix + Path(out).stem] = f"assets/{out}"

    hand = RAW / "cut-hand-overlay/cut-hand-overlay.png"
    if hand.exists():
        im = chroma_key(Image.open(hand)).resize((640, 360), Image.LANCZOS)
        im.putalpha(im.getchannel("A").point(lambda v: 255 if v > 110 else 0))
        im.save(OUT / "cut/hand.png")
        manifest["images"]["cut-hand"] = "assets/cut/hand.png"


def build_icons(manifest):
    if not (RAW / "ui-icons/ui-icons.png").exists():
        return
    im = chroma_key(Image.open(RAW / "ui-icons/ui-icons.png"))
    names = ["beam", "wave", "wait", "confirm", "intent-axe", "intent-sword", "intent-bolt",
             "protect", "move", "back", "danger-behind", "path"]
    sheet = Image.new("RGBA", (24 * 12, 24), (0, 0, 0, 0))
    for i, cell in enumerate(cells(im, 4, 3)):
        bb = alpha_bbox(cell)
        c = cell.crop(bb) if bb else cell
        s = max(c.width, c.height)
        sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        sq.alpha_composite(c, ((s - c.width) // 2, (s - c.height) // 2))
        small = sq.resize((24, 24), Image.LANCZOS)
        small.putalpha(small.getchannel("A").point(lambda v: 255 if v > 110 else 0))
        sheet.alpha_composite(small, (24 * i, 0))
    (OUT / "ui").mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / "ui/icons.png")
    manifest["icons"] = {"file": "assets/ui/icons.png", "size": 24, "names": names}


def build_wound_layers(manifest):
    """Traumbruch: entsättigte Wunde plus reine Blutebene, damit nur das Rot farbig bleibt."""
    if not (RAW / "cut-wound/cut-wound.png").exists():
        return
    im = Image.open(OUT / "cut/wound.png").convert("RGB")
    a = np.array(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    grey = (0.3 * r + 0.59 * g + 0.11 * b) * 0.85
    mono = np.stack([grey] * 3, -1).clip(0, 255).astype(np.uint8)
    Image.fromarray(mono).save(OUT / "cut/wound-mono.png")
    blood = (r > g + 35) & (r > b + 25) & (r > 70)
    rgba = np.zeros((*r.shape, 4), np.uint8)
    rgba[..., :3] = a.clip(0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(blood, 255, 0)
    Image.fromarray(rgba, "RGBA").save(OUT / "cut/wound-red.png")
    manifest["images"]["cut-wound-mono"] = "assets/cut/wound-mono.png"
    manifest["images"]["cut-wound-red"] = "assets/cut/wound-red.png"


def main():
    old = json.loads((OUT / "manifest.json").read_text()) if (OUT / "manifest.json").exists() else {}
    manifest = {"sprites": dict(old.get("sprites", {})), "images": dict(old.get("images", {}))}
    if "icons" in old:
        manifest["icons"] = old["icons"]
    if "items" in old:
        manifest["items"] = old["items"]
    build_sprites(manifest)
    build_critters(manifest)
    build_items(manifest)
    build_flat(manifest)
    build_wound_layers(manifest)
    build_icons(manifest)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(json.dumps({k: len(v) for k, v in manifest.items()}))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Prompts for the tactics art package (iso battlefield textures, iso props, battle sky backdrops).

Used by tactics_generate.py (Codex calls) and tactics_build.py (processing). No people in any image.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "output/imagegen/raw/tactics"
REFS = ROOT / "output/imagegen/style-refs"
OUT = ROOT / "game/public/assets/tactics"
PROPS_OUT = ROOT / "game/public/assets/props"
DOC = ROOT / "docs/rebuild/art/tactics.json"

STYLE = (
    "High-quality 16-bit pixel art like a modern SNES-inspired fantasy adventure RPG, crisp visible square pixels, "
    "clean dark outlines, limited warm palette, soft natural light, rich painterly pixel shading. "
    "Selantis palette: rich summer green, wheat gold, warm wood brown, brick red, stone grey, evening orange, "
    "night blue-violet. No text, no letters, no watermark, no frame, no border, no people, no animals."
)

TEX = (
    "A single SEAMLESS TILEABLE square texture tile seen from directly above (orthographic top-down, flat, no "
    "perspective, no horizon, no vignette, no lighting gradient across the image, even lighting everywhere). "
    "The pattern must wrap perfectly on all four edges. Fill the whole square edge to edge. "
)

SIDE = (
    "A single SEAMLESS TILEABLE square texture tile of a vertical earth/rock wall seen straight from the front "
    "(orthographic, flat, no perspective, no sky, no ground, no vignette, even lighting). The pattern must wrap "
    "perfectly on all four edges. Fill the whole square edge to edge. "
)

MAGENTA = ("Flat pure magenta #FF00FF background everywhere around the objects, no cast shadow on the background, "
           "no ground plane, no gradients. Objects well separated, nothing touching the image border.")

ISO = ("Isometric three-quarter view from above like the props of Final Fantasy Tactics Advance (camera about 30 "
       "degrees down), drawn as pixel art sprites for an isometric tactics battle map.")


def ref(name: str) -> str:
    return str(REFS / name)


# id -> (prompt, refs). Textures are 256x256 after processing.
TEXTURES: dict[str, tuple[str, list[str]]] = {
    "grass": (TEX + "Lush summer meadow grass: dense small grass tufts in several greens with light yellow-green "
              "tips and dark green gaps, a very few tiny white and yellow flowers. Same grass painting style as the "
              "attached map.", [ref("selantis-map-felder.png"), ref("selantis-road-east.png")]),
    "drygrass": (TEX + "Dry late-summer grass: short golden-green and straw-coloured grass tufts with a few darker "
                 "green patches and bits of bare earth.", [ref("selantis-map-hohlweg.png"), ref("selantis-map-felder.png")]),
    "dirt": (TEX + "Trodden brown earth footpath: warm brown compacted soil with small pebbles, a few tiny cracks "
             "and faint footprints, subtle variation, no grass.", [ref("selantis-map-hohlweg.png"), ref("selantis-road-east.png")]),
    "stone": (TEX + "Old worn flagstone paving: irregular grey-beige stone slabs of different sizes with dark joints, "
              "a little moss in the cracks, chipped edges.", [ref("selantis-road-east.png")]),
    "sand": (TEX + "Pale warm sand with gentle wind ripples, scattered tiny pebbles and a few shell fragments.",
             [ref("insel-bg-strand.png")]),
    "water": (TEX + "Shallow clear water over a pebbly riverbed: teal-blue water with soft light ripples and "
              "sparkling highlights, round stones visible through the water.", [ref("selantis-road-east.png"), ref("insel-bg-strand.png")]),
    "forest": (TEX + "Dark forest floor: moss, fallen brown and orange leaves, pine needles, small twigs, patches of "
               "dark green clover.", [ref("selantis-rain-forest.png")]),
    "mud": (TEX + "Wet dark mud with shallow puddles reflecting light, hoof prints and squashed grass at a few spots.",
            [ref("selantis-rain-forest.png")]),
    "cliff": (SIDE + "Dark earth and rock cliff: layered brown soil strata with embedded grey stones, small roots, "
              "cracks, darker at the joints.", [ref("selantis-map-hohlweg.png"), ref("selantis-rain-forest.png")]),
    "cliffgrass": (SIDE + "Earth bank with grass roots: warm brown soil wall woven with thin roots, small stones and "
                   "tufts of moss, like the side of a sunken lane.", [ref("selantis-map-hohlweg.png")]),
    "wall": (SIDE + "Old weathered stone masonry: rough grey-beige ashlar blocks in staggered courses with dark mortar "
             "joints, a little moss and lichen, chipped corners.", [ref("selantis-road-east.png")]),
}

# Iso props as sheets of variants on magenta. id -> (prompt, refs, variants)
PROPS: dict[str, tuple[str, list[str], int]] = {
    "iso-tree": (ISO + " Three variants of a broad deciduous oak tree with a full round leafy crown in rich summer "
                 "greens with golden sunlit tops and a dark brown trunk with visible roots, arranged in one row, each "
                 "about the same size, each standing on its own (no ground patch).", [ref("selantis-map-felder.png"), ref("selantis-road-east.png")], 3),
    "iso-pine": (ISO + " Three variants of a tall dark green pine/fir tree with layered drooping branches and a "
                 "short brown trunk, arranged in one row, each standing on its own (no ground patch).",
                 [ref("selantis-rain-forest.png"), ref("selantis-map-felder.png")], 3),
    "iso-bush": (ISO + " Four variants of a round leafy green shrub/bush, waist high, dense leaves with light tips, "
                 "one with a few small white flowers, arranged in one row, each on its own.",
                 [ref("selantis-map-felder.png"), ref("selantis-map-hohlweg.png")], 4),
    "iso-rock": (ISO + " Four variants of a large grey boulder with flat facets, moss patches on top and darker "
                 "underside, about knee to chest high, arranged in one row, each on its own.",
                 [ref("selantis-rain-forest.png"), ref("selantis-road-east.png")], 4),
    "iso-ruin": (ISO + " Three variants of a short broken ruined stone wall segment (old grey-beige ashlar blocks, "
                 "crumbling top edge, a little ivy and moss), each segment as wide as it is tall, seen at an "
                 "isometric angle, arranged in one row, each on its own.", [ref("selantis-road-east.png")], 3),
    "iso-banner-light": (ISO + " Two variants of a tall army war banner on a wooden pole planted in the ground: a "
                         "long hanging cloth banner, blue and white with a simple white bird-of-prey emblem (no "
                         "letters), slightly fluttering; one straight, one a little tattered. Arranged in one row.",
                         [ref("selantis-road-east.png")], 2),
    "iso-banner-dark": (ISO + " Two variants of a tall army war banner on a wooden pole planted in the ground: a long "
                        "hanging cloth banner quartered in black and white (no emblem, no letters), slightly "
                        "fluttering; one straight, one a little tattered. Arranged in one row.",
                        [ref("selantis-road-east.png")], 2),
    "iso-deadtree": (ISO + " Three variants of a dead leafless tree with a grey-brown gnarled trunk and bare twisted "
                     "branches, slightly burnt at the base, arranged in one row, each standing on its own.",
                     [ref("selantis-rain-forest.png")], 3),
    "iso-stump": (ISO + " Three variants of a cut tree stump with visible year rings on top, roots and a bit of moss, "
                  "arranged in one row, each on its own.", [ref("selantis-map-felder.png")], 3),
    "iso-crate": (ISO + " Two objects in one row: a sturdy wooden supply crate with iron corners, and a wooden barrel "
                  "with iron hoops, each on its own.", [ref("selantis-first-camp.png")], 2),
    "iso-stake": (ISO + " Two variants of a thick wooden stake/post driven into the ground with a coil of rope tied "
                  "around it, arranged in one row, each on its own.", [ref("selantis-first-camp.png")], 2),
    "iso-campfire": (ISO + " One unlit campfire: a ring of grey stones around a few crossed charred logs and ash, "
                     "no flames, centred.", [ref("selantis-first-camp.png")], 1),
}

BACKDROPS: dict[str, tuple[str, list[str]]] = {
    "dusk": ("A wide 16:9 painted sky backdrop for a battle scene: dramatic dusk sky over a lost battlefield, "
             "deep blue-violet clouds above, a glowing orange-red sunset low on the horizon, thin columns of dark "
             "smoke rising in the distance, faint rolling hills and a dark distant treeline as a silhouette along "
             "the lower third, the bottom quarter fading into deep night-blue darkness. Mostly sky, no buildings "
             "in the foreground, no people, no flags.", [ref("selantis-map-felder.png"), ref("selantis-first-camp.png")]),
    "night": ("A wide 16:9 painted sky backdrop for a battle scene: moonlit night above a forest, a pale full moon "
              "partly behind soft clouds, many small stars, a layered silhouette of dark pine forest along the "
              "lower third, cool blue-violet colours, the bottom quarter fading into near-black darkness. Mostly "
              "sky, no people.", [ref("selantis-rain-forest.png")]),
    "day": ("A wide 16:9 painted sky backdrop for a battle scene: bright summer afternoon sky with soft white "
            "cumulus clouds, distant blue hills and golden fields and small trees along the lower third, the bottom "
            "quarter fading into a dark blue-green shadow. Mostly sky, no people, no buildings.",
            [ref("selantis-map-felder.png"), ref("selantis-road-east.png")]),
    "forest": ("A wide 16:9 painted backdrop for a battle in the woods at late evening: tall dark tree trunks and "
               "dense forest canopy framing a dim green-gold sky glow in the centre, layers of misty forest "
               "silhouettes behind, the bottom quarter fading into near-black green darkness. No people.",
               [ref("selantis-rain-forest.png"), ref("selantis-first-camp.png")]),
}


def texture_prompt(tid: str) -> str:
    return f"{TEXTURES[tid][0]} {STYLE}"


def prop_prompt(pid: str) -> str:
    return f"{PROPS[pid][0]} {MAGENTA} {STYLE}"


def backdrop_prompt(bid: str) -> str:
    return f"{BACKDROPS[bid][0]} {STYLE.replace(' no people, no animals.', ' no people.')}"

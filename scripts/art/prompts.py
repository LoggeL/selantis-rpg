#!/usr/bin/env python3
"""Prompt library of the Selantis art pipeline (DESIGN.md §3).

Every prompt contains the binding Selantis style sentence. Character looks come from scripts/art/cast.json
(DESIGN.md §3 Figuren-Referenz, original designs — never modelled on film actors, never film frames as reference).
`python3 scripts/art/prompts.py <kind> <id> [pose|mood]` prints a prompt for inspection.
"""
from __future__ import annotations

import sys
from pathlib import Path

from lib import ROOT, STYLE_REFS, load_json

# Binding style sentence (DESIGN.md §3, verbatim).
STYLE = ("High-quality 16-bit pixel art like a modern SNES-inspired fantasy adventure RPG, crisp visible square pixels, "
         "clean dark outlines, limited warm palette, soft natural light, rich painterly pixel shading, three-quarter "
         "top-down view for maps. No text, no letters, no watermark, no frame.")
PALETTE = ("Selantis palette: rich summer green, wheat gold, warm wood brown, brick red, stone grey, evening orange, "
           "night blue-violet; turquoise ONLY for the primordial magic (Urmacht).")
PRIVACY = ("This is an ORIGINAL character design: do not make the face resemble any real person, actor or celebrity.")
MAGENTA = ("Flat pure magenta #FF00FF background everywhere (one single flat colour, no gradient), no ground shadow, "
           "no floor, no scenery, no props unless stated.")
NO_TEXT = "No text, no letters, no numbers, no labels, no captions, no watermark, no frame, no border, no grid lines."

CAST_FILE = ROOT / "scripts/art/cast.json"


def cast() -> dict:
    return load_json(CAST_FILE, {"characters": {}})["characters"]


def char(cid: str) -> dict:
    c = cast().get(cid)
    if not c:
        raise SystemExit(f"unknown character '{cid}' — add it to scripts/art/cast.json")
    return c


# ----------------------------------------------------------------------------------------- style refs
def sref(name: str) -> Path:
    return STYLE_REFS / name


SPRITE_REFS = [sref("insel-sprites-kim-walk.png")]
LANDSCAPE_REFS = [sref("selantis-map-hof.png"), sref("selantis-first-camp.png")]


def portrait_style_ref(cid: str) -> Path:
    """A portrait of a clearly different person (age/sex) so only the rendering style transfers.
    cast.json: "sex": "m"|"f" → InselRPG portrait of the other kind of person; "portraitStyle": "male"|"female" → one
    of our own finished portraits of the opposite sex (lia / valentus)."""
    c = cast().get(cid, {})
    own = ROOT / "game/public/assets/portraits"
    ps = {"male": own / "lia.png", "female": own / "valentus.png"}.get(c.get("portraitStyle", ""))
    if ps and ps.is_file():
        return ps
    if c.get("sex") in ("m", "f"):
        return sref("insel-portraits-kim.png") if c["sex"] == "m" else sref("insel-portraits-gilbert.png")
    old_man = {"valentus", "valentus-cloak"}
    base = cid.split("-")[0]
    return sref("insel-portraits-kim.png") if base in old_man or cid in old_man else sref("insel-portraits-gilbert.png")


# ------------------------------------------------------------------------------------------ characters
TURNAROUND = (
    "Character turnaround reference sheet for a 2D pixel-art RPG: the SAME character shown three times side by side in "
    "one row — LEFT: front view facing the viewer, MIDDLE: strict side profile facing RIGHT, RIGHT: back view. Full body "
    "from the top of the head to the soles of the feet, standing in a relaxed neutral pose with arms slightly away from "
    "the body, all three views at IDENTICAL scale with the feet on the same baseline, evenly spaced with wide gaps, "
    "nothing overlapping, nothing cut off. Each figure about 70% of the image height. Wide landscape image. "
)

WALK = (
    "Game character WALK CYCLE SPRITE SHEET: one square image containing a strict 4x4 grid of 16 full-body figures of "
    "the SAME character (4 rows x 4 columns, evenly spaced like the attached small walk-sheet reference, every figure "
    "centred in its own invisible square cell, identical scale in all 16 frames, wide empty gaps, nothing touching, "
    "nothing cut off at the edges). Each row is one walking direction with a 4-frame walk cycle, feet on a common "
    "baseline per row:\n"
    "ROW 1 (top): facing SOUTH — front view walking toward the viewer.\n"
    "ROW 2: facing WEST — strict side profile walking toward the LEFT edge of the image (face, nose and toes point LEFT).\n"
    "ROW 3: facing EAST — strict side profile walking toward the RIGHT edge of the image (face, nose and toes point RIGHT).\n"
    "ROW 4 (bottom): facing NORTH — back view walking away from the viewer (we see the back of the head).\n"
    "The 4 frames of every row MUST show a clear, readable walk cycle: frame 1 = LEFT leg forward and RIGHT arm forward "
    "(wide stride, contact pose), frame 2 = passing pose (legs together, one knee lifted, body slightly higher), frame 3 "
    "= RIGHT leg forward and LEFT arm forward (wide stride, contact pose), frame 4 = passing pose with the other knee "
    "lifted. Arms swing opposite to the legs. In the side rows the stride is wide and clearly visible; in the front and "
    "back rows the legs alternate visibly (one foot lifted and forward). Skirts and cloaks swing with the stride. "
    "Slight three-quarter top-down game camera. Compact, readable game sprite with chunky pixels and bold dark outline, "
    "simple clear shapes that stay readable when shrunk to about 42 pixels tall, natural proportions (about 6 heads "
    "tall, not chibi). Identical clothing, colours, hair and accessories in all 16 frames. "
)

SNEAK = (
    "Game character SNEAK-WALK CYCLE SPRITE SHEET (crouch walking): one square image containing a strict 4x4 grid of 16 "
    "full-body figures of the SAME character (4 rows x 4 columns, evenly spaced like the attached small walk-sheet "
    "reference, every figure centred in its own invisible square cell, identical scale in all 16 frames, wide empty gaps, "
    "nothing touching, nothing cut off at the edges). In EVERY frame the character sneaks in a LOW CROUCH: knees deeply "
    "bent, hips low, back hunched forward, head ducked between the shoulders but eyes alert, arms held close to the body "
    "and slightly forward for balance. The crouching figure is only about three quarters as tall as when standing "
    "upright. Each row is one direction with a 4-frame cautious tiptoe step cycle, feet on a common baseline per row:\n"
    "ROW 1 (top): facing SOUTH — front view creeping toward the viewer.\n"
    "ROW 2: facing WEST — strict side profile creeping toward the LEFT edge of the image (face, nose and toes point LEFT).\n"
    "ROW 3: facing EAST — strict side profile creeping toward the RIGHT edge of the image (face, nose and toes point RIGHT).\n"
    "ROW 4 (bottom): facing NORTH — back view creeping away from the viewer (we see the back of the head and the "
    "hunched back).\n"
    "The 4 frames of every row show short, careful crouched steps: frame 1 = LEFT foot placed forward, frame 2 = feet "
    "close together, frame 3 = RIGHT foot placed forward, frame 4 = feet close together again. The body stays low in "
    "all frames (no standing up between steps). Skirts and cloaks hang low and close. Slight three-quarter top-down game "
    "camera. Compact, readable game sprite with chunky pixels and bold dark outline, simple clear shapes that stay "
    "readable when shrunk, natural proportions (not chibi). Identical clothing, colours, hair and accessories in all 16 "
    "frames, matching the attached walk sheet of this character. "
)

POSE_PAIR = (
    "Two full-body game sprites of the SAME character side by side, at IDENTICAL scale, with their ground contact on the "
    "same horizontal baseline and a wide empty gap between them: LEFT = the character standing straight in a neutral "
    "front view (scale reference); RIGHT = the same character in the pose described below. Slight three-quarter "
    "top-down game camera, compact readable game sprite style with chunky pixels and bold dark outline, natural "
    "proportions (not chibi). Nothing cut off. "
)

# Default pose descriptions. Poses face three-quarter RIGHT (the runtime mirrors them for 'left').
POSES: dict[str, dict] = {
    "sit": {"text": "Pose (RIGHT figure): sitting on the ground, legs bent and tucked to one side, upper body upright, "
                    "hands resting in the lap, body turned three-quarter toward the RIGHT side of the image.",
            "measure": "pair"},
    "kneel": {"text": "Pose (RIGHT figure): kneeling on both knees, sitting back on the heels, upper body upright, head "
                      "slightly bowed, hands resting on the thighs, body turned three-quarter toward the RIGHT.",
              "measure": "pair"},
    "crouch": {"text": "Pose (RIGHT figure): crouching low to hide or sneak, knees deeply bent, back hunched, one hand "
                       "touching the ground, head raised and alert, looking toward the RIGHT side of the image.",
               "measure": "pair"},
    "hurt": {"text": "Pose (RIGHT figure): standing but flinching in pain, recoiling and hunched forward, one hand "
                     "clutching the side of the stomach, eyes squeezed shut, body turned three-quarter toward the RIGHT.",
             "measure": "pair"},
    "read": {"text": "Pose (RIGHT figure): standing and reading an open book held in both hands at chest height, head "
                     "tilted down toward the pages, body turned three-quarter toward the RIGHT.",
             "measure": "pair"},
    "sit-read": {"text": "Pose (RIGHT figure): sitting on the ground with the legs stretched out and crossed at the "
                         "ankles, BAREFOOT (no shoes), an open book resting on the lap and held with both hands, head "
                         "bent over the pages, absorbed in reading, body turned three-quarter toward the RIGHT.",
                 "measure": "pair"},
    "cast": {"text": "Pose (RIGHT figure): standing in a firm stance casting magic, one arm stretched forward toward the "
                     "RIGHT with the open palm, a small bright glow of light at the palm in the colour described below "
                     "(turquoise ONLY for the primordial magic of Valentus and Lia), the other arm drawn back, body "
                     "turned toward the RIGHT.",
             "measure": "pair"},
    # Weapon poses get a 96x64 cell (foot 48,60), see WIDE_POSES in characters.py.
    "attack": {"text": "Pose (RIGHT figure): ATTACKING — a dynamic melee strike toward the RIGHT side of the image: "
                       "lunging forward with the front foot planted, the weapon swung or thrust forward at the moment of "
                       "impact, determined face, body turned three-quarter toward the RIGHT. Compact pose: the weapon "
                       "stays close to the body, the whole figure including the weapon fits inside a square.",
               "measure": "pair"},
    "shoot": {"text": "Pose (RIGHT figure): aiming and shooting a ranged weapon toward the RIGHT side of the image, "
                      "firm side stance, body turned toward the RIGHT.",
              "measure": "pair"},
    "talk": {"text": "Pose (RIGHT figure): standing and talking with a gesture, one hand raised with the open palm as "
                     "if explaining, the other arm relaxed, body turned three-quarter toward the RIGHT.",
             "measure": "pair"},
    "interact": {"text": "Pose (RIGHT figure): standing and busy with the hands at waist height, body turned "
                         "three-quarter toward the RIGHT.",
                 "measure": "pair"},
    "fall": {"text": "Pose (RIGHT figure): struck down and COLLAPSING — caught mid-fall about halfway to the ground, "
                     "knees buckling, body toppling backward toward the LEFT, head thrown back, arms flung out, the "
                     "weapon slipping from the hand, body facing three-quarter toward the RIGHT.",
             "measure": "pair"},
    "sit-chair": {"text": "Pose (RIGHT figure): sitting upright on a simple wooden chair (plain four-legged chair with a "
                          "low straight backrest, the WHOLE chair visible down to its feet on the ground), both feet on "
                          "the floor, hands resting in the lap, body turned three-quarter toward the RIGHT.",
                  "measure": "pair"},
    "carry": {"text": "Pose (RIGHT figure): standing upright and carrying an armful of split firewood logs held against "
                      "the chest with both arms, the logs stacked horizontally, body turned three-quarter toward the "
                      "RIGHT.",
              "measure": "pair"},
    "drunk-sit": {"text": "Pose (RIGHT figure): TIPSY, sitting slumped on a simple wooden bench (the WHOLE bench "
                          "visible down to its feet on the ground), swaying and leaning to one side, one elbow propped "
                          "on the knee to hold himself up, the other hand holding a wooden tankard of ale, cheeks "
                          "flushed red, eyes half-closed, a happy dopey grin, body turned three-quarter toward the "
                          "RIGHT.",
                  "measure": "pair"},
    "hang": {"text": "Pose (RIGHT figure): a funny cartoon-style SNARE TRAP gag: the character dangles UPSIDE DOWN, "
                     "caught by both BOOTS in a rope snare loop of a hunting trap; from the boots a SHORT straight piece "
                     "of the snare rope (about one head long) leads straight up and ends at the top of the figure. The "
                     "body points head-down, the head at the BOTTOM a hand's width above the ground line (NOT touching "
                     "the ground), the hair falling down, body turned three-quarter toward the RIGHT. She is unhurt, "
                     "safe and just very annoyed, a light-hearted comedy moment. The upside-down figure is as long as "
                     "the standing figure is tall (plus the short rope).",
             "measure": "pair"},
    "frozen": {"text": "Pose (RIGHT figure): FROZEN in the middle of an attacking leap toward the RIGHT: one foot pushing off "
                       "the ground, the other knee raised forward, body leaning forward, the RIGHT arm thrust forward with a "
                       "drawn knife, the LEFT arm back for balance, a fierce determined face, body turned three-quarter "
                       "toward the RIGHT. Compact pose: the whole figure fits inside a square.",
               "measure": "pair"},
    "crumble": {"text": "Pose (RIGHT figure): exactly the same frozen attacking leap as a statue, but the stone is BREAKING "
                        "APART: cracks everywhere, chunks and flakes of grey stone bursting off and falling, and underneath "
                        "patches of real living skin, hair and coloured clothes already show through, body turned "
                        "three-quarter toward the RIGHT. Compact pose: the whole figure fits inside a square.",
                "measure": "pair"},
    "lie": {"text": "Pose (RIGHT figure): lying flat on the ground on the back, unconscious or asleep, body stretched out "
                    "HORIZONTALLY (head on the LEFT, feet on the RIGHT), arms relaxed at the sides, eyes closed. Seen "
                    "slightly from above so face and clothing are readable. The lying figure is as long as the standing "
                    "figure is tall.",
            "measure": "pair-lie"},
}

STAND_WEAPON = "The LEFT standing figure holds its weapon the same way as in the reference sheet, close to the body."
STAFF_STAND = ("The LEFT standing figure holds the staff upright in her RIGHT hand exactly as in the reference "
               "sheet.")

# Character-specific pose tweaks.
POSE_EXTRA: dict[tuple[str, str], str] = {
    ("lia", "cast"): "This is Lia's uncontrolled outburst of the turquoise primordial magic: both arms flung forward "
                     "with open palms, bright turquoise light swirling around her hands, hair and skirt blown back, "
                     "eyes glowing blue. Turquoise glow only around the hands, not filling the background.",
    ("lia-cloak", "cast"): "This is Lia's uncontrolled outburst of the turquoise primordial magic: both arms flung "
                           "forward with open palms, bright turquoise light swirling around her hands, cloak and hair "
                           "blown back, eyes glowing blue. Turquoise glow only around the hands.",
    ("lia", "read"): "She is barefoot here (clogs set aside).",
    ("lia-cloak", "read"): "She holds a folded old paper map or letter instead of a book.",
    ("valentus", "cast"): "Grand master mage casting a beam: right arm stretched forward, open palm, turquoise light "
                          "gathering at the palm. NO staff.",
    ("valentus-cloak", "cast"): "Wounded mage casting with his LEFT arm stretched forward (open palm, turquoise glow), "
                                "the right hand still pressed against the wound. NO staff.",
    ("valentus-cloak", "hurt"): "He staggers, both hands pressed to the bleeding wound at his RIGHT side below the ribs.",
    ("kyra-bound", "sit"): "Her bound wrists rest in her lap, defiant look.",
    ("kyra-bound", "kneel"): "Her bound wrists in front of her, head raised defiantly.",
    ("kyra-bound", "crouch"): "Crouching with her bound wrists held in front of her, sneaking.",
    ("kyra-bound", "hurt"): "Flinching, bound wrists raised to protect her face.",
    # ---- batch chars-prolog-hof

    ("mother", "kneel"): "She kneels on the ground pleading, hands clasped together in front of her chest, looking up "
                         "fearfully.",
    ("father", "kneel"): "He kneels on the ground, forced down, hands raised slightly in a calming, pleading gesture, "
                         "head raised.",
    ("mother", "lie"): "She lies motionless on her back, eyes closed (no blood, no gore).",
    ("father", "lie"): "He lies motionless on his back, eyes closed (no blood, no gore).",
    ("mother", "hurt"): "She recoils in pain and fear, one hand pressed to her side, the other raised defensively.",
    ("father", "hurt"): "He recoils from a blow, hunched forward, one hand pressed to his stomach.",
    ("orwen", "attack"): "He slashes forward with his drawn sword held in his RIGHT gloved hand, long dark coat "
                         "swinging, cold cruel face. The empty scabbard stays at his hip. " + STAND_WEAPON,
    ("orwen", "talk"): "Instead of gesturing he stands upright and arrogant with BOTH ARMS CROSSED firmly over the "
                       "chest, chin raised, a cold contemptuous look. His sword stays sheathed at his hip. Gold brooch "
                       "visible on the coat.",
    ("algard", "attack"): "He swings his one-handed battle axe in a downward diagonal chop, mocking grin. " + STAND_WEAPON,
    ("maedchen", "attack"): "He thrusts his spear forward horizontally with both hands toward the RIGHT; keep the "
                            "spear short enough to fit (grip near the middle of the shaft). " + STAND_WEAPON,
    ("harro", "attack"): "He hacks forward clumsily with his short sword. " + STAND_WEAPON,
    ("shadow-sword", "attack"): "He slashes with the sword, shield raised in front of the body. " + STAND_WEAPON,
    ("shadow-spear", "attack"): "He thrusts the spear forward horizontally with both hands toward the RIGHT (grip near "
                                "the middle of the shaft so it fits). " + STAND_WEAPON,
    ("shadow-crossbow", "attack"): "He aims and shoots the crossbow toward the RIGHT, crossbow raised to the shoulder, "
                                   "a bolt just leaving it. " + STAND_WEAPON,
    ("shadow-club", "attack"): "He swings the nail-studded club overhead in a heavy downward blow (the club raised "
                               "just above his head). " + STAND_WEAPON,
    ("shadow-sword", "hurt"): "Struck, staggering back, shield lowered. " + STAND_WEAPON,
    ("shadow-spear", "hurt"): "Struck, staggering back, spear held loosely. " + STAND_WEAPON,
    ("shadow-crossbow", "hurt"): "Struck, staggering back, crossbow lowered. " + STAND_WEAPON,
    ("shadow-club", "hurt"): "Struck, staggering back, club lowered. " + STAND_WEAPON,
    ("shadow-sword", "fall"): STAND_WEAPON,
    ("shadow-spear", "fall"): STAND_WEAPON,
    ("shadow-crossbow", "fall"): STAND_WEAPON,
    ("shadow-club", "fall"): STAND_WEAPON,
    ("baris-young", "attack"): "He swings the huge two-handed axe in a mighty sideways cleave with both hands, the axe "
                               "head at shoulder height, furious unblinking stare. " + STAND_WEAPON,
    ("baris-young", "hurt"): "Struck hard, staggering, one hand pressed to a bleeding wound at his side, the axe held "
                             "low in the other hand. " + STAND_WEAPON,
    ("baris-young", "kneel"): "WOUNDED and beaten: kneeling on ONE knee, one hand pressed against a bleeding wound at "
                              "his side, the other hand leaning on the axe haft planted on the ground, head hanging, "
                              "still glaring. " + STAND_WEAPON,
    ("falke-soldier", "attack"): "He strikes with both short swords in a fast crossing slash. " + STAND_WEAPON,
    ("falke-soldier", "hurt"): "Struck, recoiling, both short swords lowered. " + STAND_WEAPON,
    ("paladin", "attack"): "He thrusts the spear forward horizontally with both hands toward the RIGHT (grip near the "
                           "middle of the shaft so it fits). " + STAND_WEAPON,
    ("council-mage-a", "cast"): "The glow at her palm is warm GOLDEN light (not turquoise). NO staff.",
    ("council-mage-b", "cast"): "The glow at his palm is cold pale SILVER-WHITE light (not turquoise). NO staff.",
    ("council-mage-c", "cast"): "The glow at his palm is amber YELLOW light (not turquoise). NO staff.",
    ("ignatius", "cast"): "The glow at his palm is a small warm ORANGE FLAME (fire magic of Ignis, not turquoise). "
                          "NO staff.",
    # ---- batch chars-reise

    ("foltan", "attack"): "He slashes with his straight sword held in his RIGHT hand (sword drawn from the scabbard, "
                          "blade angled up and forward), LEFT arm back for balance; the crossbow stays on his back.",
    ("foltan", "shoot"): "He aims his wooden crossbow with both hands at shoulder height toward the RIGHT, cheek "
                         "against the stock, one eye squinting; the sword stays in its scabbard.",
    ("foltan", "lie"): "Asleep on his back, his beret pulled down slightly over his eyes, hands folded on his chest.",
    ("foltan", "hurt"): "He flinches, LEFT hand pressed against his RIGHT upper arm.",
    ("azar", "attack"): "He swings his curved scimitar held in his RIGHT hand in a wide but compact slash, his belly "
                        "and yellow tunic swinging, a determined but slightly frightened face.",
    ("azar", "lie"): "Asleep and snoring on his back, round belly up, mouth open, hands resting on the belly.",
    ("azar", "sit"): "Sitting cross-legged on the ground, hands on his knees, comfortable and jovial.",
    ("craupor", "interact"): "He wipes a pewter tankard with a white cloth rag, holding the tankard in his LEFT hand "
                             "and the cloth in his RIGHT hand, standing as if behind a bar counter, looking up "
                             "obligingly.",
    ("elnon", "talk"): "Cool and composed, he gestures with his RIGHT hand while speaking, LEFT hand resting on the "
                       "head of the axe at his belt.",
    ("alastir", "talk"): "Grave, he speaks with a restrained gesture of his RIGHT hand, his LEFT hand holding the "
                         "edge of his cape.",
    ("flick", "shoot"): "She draws her wooden longbow to full draw toward the RIGHT: LEFT arm stretched out holding "
                        "the bow upright, RIGHT hand pulling the string back to her cheek, an arrow nocked.",
    ("flick", "attack"): "She lunges and stabs forward with her hunting knife in her RIGHT hand, the bow held in her "
                         "LEFT hand down at her side.",
    ("flick", "crouch"): "Sneaking low, the bow held in her LEFT hand close to the ground, alert.",
    ("flick", "lie"): "She lies defenceless on her back, the bow dropped beside her, eyes closed.",
    ("flick", "sit"): "Sitting on the ground with one knee drawn up, her RIGHT forearm resting on the knee, the bow "
                      "lying across her lap, relaxed and cocky.",
    ("baris", "attack"): "He swings his huge battle axe with both hands in a brutal diagonal strike forward and down "
                         "toward the RIGHT, the axe head at the height of his chest in front of him (NOT raised high "
                         "above his head), a heavy wide stance.",
    ("baris", "hurt"): "He staggers backward, his LEFT gauntlet raised to his face, the axe hanging low in his RIGHT "
                       "hand.",
    ("baris", "kneel"): "Forced down onto ONE knee in submission, head bowed, his RIGHT gauntleted fist on the "
                        "ground, his axe lying on the ground beside him.",
    ("vamir", "cast"): "He raises one arm toward the RIGHT, the pale bony fingers spread, and a crackling ball of "
                       "COLD VIOLET dark magic with purple-black smoke gathers at his hand (violet and black only, "
                       "absolutely NO turquoise, NO blue-green); the face stays completely hidden in the hood's "
                       "darkness.",
    ("ghoul", "attack"): "He leaps forward swinging his rusty axe in his RIGHT hand in a vicious downward chop, "
                         "hunched and feral.",
    ("ghoul", "hurt"): "He recoils from a hit, hunched, the axe swinging away, LEFT hand clutching his chest.",
    ("ghoul", "lie"): "Dead: sprawled face-down on the ground, the masked head turned to the side, limbs splayed, the "
                      "axe lying next to his hand.",
    # ---- Teil II „Letzte Hoffnung“ (area teil-2)

    ("e2-lia-stab", "cast"): "INSTEAD of an open palm she uses the staff. CONTROLLED, focused casting, NOT an outburst: she stands firmly and points the staff "
                             "forward toward the RIGHT with both hands (RIGHT hand on the leather grip, LEFT hand further "
                             "up the shaft), the knotted tip aimed forward. Only a SMALL, soft TURQUOISE light glows at "
                             "the knotted tip of the staff — no explosion, no beam, no swirl around her, hair and cloak "
                             "calm, eyes normal (not glowing). " + STAFF_STAND,
    ("e2-lia-stab", "attack"): "A short, controlled staff swing: she holds the staff with both hands near the middle "
                               "and strikes sideways toward the RIGHT with the knotted end, compact, the staff kept "
                               "close to the body; no glow, no magic. " + STAFF_STAND,
    ("e2-lia-stab", "sit"): "Sitting on the ground, the staff held loosely upright in her RIGHT hand and leaning "
                            "against her RIGHT shoulder, its foot on the ground. " + STAFF_STAND,
    ("e2-lia-stab", "kneel"): "Kneeling on ONE knee, holding the staff upright in her RIGHT hand with its foot planted "
                              "on the ground beside her, leaning lightly on it. " + STAFF_STAND,
    ("e2-lia-stab", "lie"): "Asleep on her back, the staff lying on the ground right beside her, parallel to her body. "
                            "No glow.",
    ("e2-lia-stab", "hurt"): "She flinches, the staff still gripped in her RIGHT hand but lowered and slanting. "
                             + STAFF_STAND,
    ("e2-ignatius", "cast"): "The glow at his RIGHT palm is a small, soft, warm AMBER-GOLD light (honey-coloured glow, "
                             "not fire, absolutely not turquoise). NO staff.",
    ("e2-ignatius", "sit"): "Sitting cross-legged on the ground, hands resting on his knees, relaxed and patient.",
    ("e2-ignatius", "talk"): "He explains with his RIGHT hand raised, index finger lifted like a teacher, LEFT hand "
                             "resting on his belt.",
    ("e2-ignatius", "carry"): "The firewood is pale split logs with bark, about six pieces, held against his chest "
                              "under his crossed forearms.",
    ("e2-flick-gefangen", "sit"): "Sitting on the ground with her knees drawn up, chained wrists resting on her knees, "
                                  "glaring defiantly.",
    ("e2-flick-gefangen", "sit-chair"): "Her CHAINED wrists rest in her lap, the short iron chain between the "
                                        "manacles clearly visible, defiant upright posture, chin raised.",
    ("e2-flick-gefangen", "kneel"): "Forced to kneel, chained wrists in front of her, head raised defiantly.",
    ("e2-flick-gefangen", "crouch"): "Crouching low and sneaking, chained wrists held together in front of her close "
                                     "to the ground, alert.",
    ("e2-flick-gefangen", "lie"): "Lying on her back, exhausted and unconscious, chained wrists resting on her "
                                  "stomach. No blood.",
    ("e2-flick-gefangen", "hurt"): "Flinching, chained wrists raised together to protect her face.",
    ("e2-druide", "interact"): "He holds a shallow wooden bowl in his LEFT hand at waist height and sprinkles a pinch "
                               "of dried herbs into it with his RIGHT hand, focused.",
    ("e2-druide", "talk"): "He speaks calmly with an open RIGHT palm, LEFT hand resting on the herb pouches at his belt.",
    ("baris-scarred", "attack"): "He swings his huge battle axe with both hands in a brutal diagonal strike forward and "
                                 "down toward the RIGHT, the axe head at the height of his chest in front of him (NOT "
                                 "raised high above his head), a heavy wide stance. " + STAND_WEAPON,
    ("baris-scarred", "kneel"): "Kneeling on ONE knee before his master, head bowed, his RIGHT gauntleted fist on the "
                                "ground, the axe lying on the ground beside him.",
    ("baris-scarred", "talk"): "He stands upright and menacing, gesturing with his LEFT gauntlet, the axe held low in "
                               "his RIGHT hand beside his leg. " + STAND_WEAPON,
    ("e2-elnon-gefangen", "kneel"): "Forced to kneel on both knees, chained wrists resting in front of him, back "
                                    "straight and head raised with quiet dignity.",
    ("e2-elnon-gefangen", "sit"): "Sitting on the ground leaning back slightly, one knee drawn up, the chained wrists "
                                  "resting on that knee, weary.",
    ("e2-elnon-gefangen", "lie"): "Lying on his back, exhausted and unconscious, chained wrists resting on his "
                                  "stomach. No blood.",
    ("e2-elnon-gefangen", "hurt"): "He doubles over from a blow, chained wrists pressed against his stomach, teeth "
                                   "gritted. No blood.",
    ("e2-elnon-gefangen", "fall"): "He has NO weapon: the chained wrists fly up together as he topples backward. "
                                   "No blood.",
    ("e2-kyra-gebannt", "attack"): "A stiff, mechanical sword thrust: she stabs the short sword forward toward the "
                                   "RIGHT with her RIGHT arm straight, the blade kept close and compact, her face "
                                   "blank and expressionless like a puppet, no glow, no magic effect. The LEFT "
                                   "standing figure holds the short sword low in her RIGHT hand, pointing down.",
    ("e2-kyra-gebannt", "kneel"): "Kneeling on both knees, stiff and upright like a puppet, staring blankly ahead, "
                                  "the short sword lying flat on the ground in front of her knees.",
    ("e2-kyra-gebannt", "lie"): "Lying on her back, unconscious, the spell broken, eyes closed, hands empty and "
                                "relaxed, the short sword lying on the ground beside her. No rope. No blood.",
    # Logge (Nutzerwunsch: der Spielemacher als Chronist-NPC, area teil-2)
    ("logge", "sit"): "INSTEAD of sitting on the ground he sits on a small, low, three-legged wooden stool (the WHOLE "
                      "stool visible down to its feet), one ankle resting on the other knee, a small open book "
                      "propped on that knee, writing in it eagerly with the white quill in his RIGHT hand, grinning.",
    ("logge", "talk"): "He talks enthusiastically, RIGHT hand raised and pointing the white quill upward like a "
                       "teacher's pointer, LEFT hand on the strap of his satchel, a big mischievous grin.",
    ("logge", "read"): "He reads a small open book held close to his face in both hands, the round orange-tinted "
                       "spectacles now pulled DOWN onto his nose, eyebrows raised in amusement.",
    ("logge", "kneel"): "Kneeling on ONE knee, bent forward, holding out his LEFT hand low toward the ground as if "
                        "offering a treat to a small animal, the quill still behind his ear, smiling.",
    ("logge", "drunk-sit"): "The round orange-tinted spectacles have slipped crookedly onto his hair, the quill still "
                            "behind his ear, a little ale foam on the tankard.",
    # Sebastian und Pascal (Nutzerwunsch 2026-10-07: Wirtshausgäste nach privaten Fotos, area teil-2)
    ("sebastian", "sit"): "INSTEAD of sitting on the ground he sits UPRIGHT on a short plain wooden bench (the WHOLE "
                          "bench visible down to its feet), back straight, both forearms raised forward at chest "
                          "height with the hands folded together as if resting on the edge of a table in front of "
                          "him (do NOT draw the table), the lute still on his back, a friendly grin.",
    ("sebastian", "talk"): "He talks animatedly like a storyteller, RIGHT hand raised with the open palm in a "
                           "theatrical flourish, eyebrows raised high, a big grin, the lute on his back.",
    ("sebastian", "interact"): "He has swung the lute round to the front and PLAYS it at waist height: LEFT hand on the "
                               "neck, RIGHT hand strumming the strings, head tilted, grinning.",
    ("pascal", "sit"): "INSTEAD of sitting on the ground he sits alone on a small low three-legged wooden stool (the "
                       "WHOLE stool visible down to its feet) at a small, low, round wooden table placed directly in "
                       "front of him on the RIGHT, drumming on the table top with two small wooden spoons, one in "
                       "each hand, straw hat on, deadpan face. Keep the table small so figure, stool and table form "
                       "one compact group.",
    ("pascal", "talk"): "He talks dryly with a deadpan face, one eyebrow raised, RIGHT hand lifted holding the two "
                        "wooden spoons and pointing them like a little baton, LEFT thumb hooked under an orange "
                        "brace.",
    # ---- Teil III „Falscher Glaube“ (area teil-3)

    ("e3-lia-eigenstab", "cast"): "INSTEAD of an open palm she uses her own pale spiral staff. CONTROLLED, focused "
                                  "casting, NOT an outburst: she stands firmly and points the staff forward toward the "
                                  "RIGHT with both hands (RIGHT hand low on the shaft, LEFT hand further up), the slender "
                                  "spiral tip aimed forward. Only a SMALL, soft TURQUOISE light glows at the spiral tip — "
                                  "no explosion, no beam, no swirl around her, hair and cloak calm, eyes normal (not "
                                  "glowing). " + STAFF_STAND,
    ("e3-lia-eigenstab", "attack"): "A short, controlled staff swing: she holds the pale staff with both hands near the "
                                    "middle and strikes sideways toward the RIGHT with the spiral end, compact, the staff "
                                    "kept close to the body; no glow, no magic. " + STAFF_STAND,
    ("e3-lia-eigenstab", "sit"): "Sitting on the ground, the pale staff held loosely upright in her RIGHT hand and "
                                 "leaning against her RIGHT shoulder, its foot on the ground. " + STAFF_STAND,
    ("e3-lia-eigenstab", "kneel"): "Kneeling on ONE knee, holding the pale staff upright in her RIGHT hand with its foot "
                                   "planted on the ground beside her, leaning lightly on it. " + STAFF_STAND,
    ("e3-lia-eigenstab", "lie"): "Asleep on her back, the pale spiral staff lying on the ground right beside her, "
                                 "parallel to her body. No glow.",
    ("e3-lia-eigenstab", "hurt"): "She flinches, the pale staff still gripped in her RIGHT hand but lowered and "
                                  "slanting. " + STAFF_STAND,
    ("e3-lia-gefesselt", "sit"): "Sitting on the ground with her knees drawn up, her rope-bound wrists resting on her "
                                 "knees, tired and frightened but with a stubborn set to her mouth.",
    ("e3-lia-gefesselt", "kneel"): "Forced to kneel on both knees, her rope-bound wrists held in front of her, head "
                                   "raised, scared but defiant.",
    ("e3-lia-gefesselt", "lie"): "Lying on her back, eyes closed, her rope-bound wrists resting on her stomach, the "
                                 "cloak spread beneath her. No blood.",
    ("e3-lia-innen", "sit"): "Sitting in soft grass with her legs tucked to one side, the long white lace dress spread "
                             "around her, bare feet visible, hands resting in her lap, her loose hair falling over her "
                             "shoulders, looking up calmly.",
    ("e3-ignatius-gefesselt", "kneel"): "Forced to kneel on both knees, his rope-bound wrists resting in front of him, "
                                        "back straight and head raised with weary dignity.",
    ("e2-ignatius", "lie"): "Lying on his back with the brown cloak spread beneath him, eyes closed, a peaceful face, "
                            "both hands resting folded on his chest over the beard. No blood, no wound. NO staff.",
    ("e2-ignatius", "hurt"): "He staggers back, struck by an invisible blow of cold magic: hunched forward, both hands "
                             "pressed to his chest, face twisted in pain, teeth gritted. No blood. NO staff.",
    ("e3-grossmeister", "talk"): "He speaks with authority: standing very upright, his RIGHT hand raised with the palm "
                                 "turned down in a commanding, measured gesture (the gold signet ring visible), his LEFT "
                                 "hand resting on his broad belt, chin raised, stern.",
    ("e3-grossmeister", "sit"): "INSTEAD of sitting on the ground he sits UPRIGHT as if enthroned on a high chair, but "
                                "the chair is NOT drawn at all (the seat is invisible; the game background provides the "
                                "chair): thighs horizontal, lower legs vertical with both boots flat on the ground, back "
                                "straight, both forearms resting forward as if on armrests, hands relaxed, stern gaze.",
    ("e3-doktor", "talk"): "He lectures impatiently: RIGHT index finger raised like a pedant, LEFT hand holding the "
                           "round magnifying glass by its handle at chest height, eyebrows raised, slightly smug.",
    ("e3-doktor", "interact"): "Busy with an experiment at waist height: he holds a small clear glass crystal up in his "
                               "LEFT hand and peers at it through the round magnifying glass in his RIGHT hand, leaning "
                               "forward, frowning in concentration.",
    ("e3-doktor", "read"): "He reads a heavy old leather-bound book held open in his LEFT arm, the RIGHT index finger "
                           "tracing a line, his nose close to the pages, absorbed.",
    # Paladins with their own faces (paladin-*): same spear thrust as the base paladin, the captain uses a sword.
    ("paladin-anfuehrer", "attack"): "He thrusts the spear forward horizontally with both hands toward the RIGHT (grip "
                                     "near the middle of the shaft so it fits), bare head, stern face. " + STAND_WEAPON,
    ("paladin-jung", "attack"): "He thrusts the spear forward horizontally with both hands toward the RIGHT (grip near "
                                "the middle of the shaft so it fits), a little clumsy, eyes wide, bare head. "
                                + STAND_WEAPON,
    ("paladin-hauptmann", "attack"): "He swings his longsword with both hands in a powerful diagonal slash forward and "
                                     "down toward the RIGHT, the blade in front of his chest (NOT raised high above the "
                                     "head), the blue cape swinging, bald head. " + STAND_WEAPON,
    ("paladin-novize", "attack"): "He thrusts the short spear forward with both hands toward the RIGHT (grip near the "
                                  "middle of the shaft so it fits), determined but unsure. " + STAND_WEAPON,
    ("paladin-wache", "attack"): "She thrusts the spear forward horizontally with both hands toward the RIGHT (grip near "
                                 "the middle of the shaft so it fits), the braid swinging, calm focused face. "
                                 + STAND_WEAPON,
    # The goblin trio Ratz, Hotze, Fips (comic relief, they caught Flick)
    ("goblin-ratz", "sit"): "Sitting on the ground cross-legged like a king on a throne, back straight, chin raised, the "
                            "wooden spoon held upright like a sceptre in his RIGHT hand, the pot helmet slipping over one "
                            "eye.",
    ("goblin-ratz", "attack"): "He whacks forward and down with the big wooden spoon held in both hands like a club, "
                               "the oversized pot helmet bouncing on his head, a furious squeal. " + STAND_WEAPON,
    ("goblin-ratz", "hurt"): "He staggers back, the pot helmet knocked down over his eyes, both hands pushing it up, the "
                             "spoon dangling from one hand.",
    ("goblin-ratz", "crouch"): "Sneaking low on tiptoe, the spoon held close, the pot helmet pushed back, grinning "
                               "slyly.",
    ("goblin-hotze", "sit"): "Sitting on the ground with his short legs stretched out and his belly on his lap, happily "
                             "biting the sausage off the roasting spit held in his RIGHT hand.",
    ("goblin-hotze", "attack"): "He jabs the roasting spit forward toward the RIGHT with both hands like a little spear, "
                                "belly wobbling, the sausage still on the tip. " + STAND_WEAPON,
    ("goblin-hotze", "hurt"): "He flinches with both hands on his round belly, the spit dropped at his feet, cheeks "
                              "puffed out.",
    ("goblin-hotze", "crouch"): "Crouching as low as his belly allows, the spit held close, sniffing the air hungrily.",
    ("goblin-fips", "sit"): "Sitting on the ground with his knees pulled up, fidgeting, counting pebbles from his pocket "
                            "into his palm, the slingshot lying across his knees.",
    ("goblin-fips", "attack"): "He shoots the slingshot toward the RIGHT: LEFT arm stretched out holding the Y-shaped "
                               "slingshot, RIGHT hand pulling the leather pouch back to his huge nose, one eye squinting, "
                               "a pebble flying away. " + STAND_WEAPON,
    ("goblin-fips", "hurt"): "He jumps back in fright, ears flattened, both hands clutching his big nose, the feathers "
                             "in his hair askew.",
    ("goblin-fips", "crouch"): "Crouching low on his toes, hopping nervously, the slingshot loaded and ready, looking "
                               "around with bulging eyes.",
    # Flick hanging upside down in the goblins' camp, Flick turned to stone, Flick as Lia's guard
    ("e2-flick-gefangen", "hang"): "Her manacled forearms are FOLDED over her chest (like crossed arms), an annoyed, "
                                   "sarcastic, eye-rolling face, as if bored of waiting. Her short dark hair falls "
                                   "down. No net.",
    ("e3-flick-stein", "frozen"): "She is a STATUE of grey stone: the whole figure including hair, clothes, knife and "
                                  "bow is one solid grey granite colour with stone texture, small cracks with a faint "
                                  "glowing VIOLET light inside. The LEFT standing figure is the same grey stone statue "
                                  "standing upright.",
    ("e3-flick-stein", "crumble"): "Grey stone shell cracking open with a few faint violet sparks fading; underneath her "
                                   "real freckled skin, almost-black hair and olive-green coat show through in patches. "
                                   "The LEFT standing figure is the grey stone statue standing upright.",
    ("flick-beschuetzerin", "shoot"): "She draws her new longbow to full draw toward the RIGHT: LEFT arm stretched out "
                                      "holding the bow upright, RIGHT hand pulling the string back to her cheek, an arrow "
                                      "nocked, the white-and-blue cloak swinging.",
    ("flick-beschuetzerin", "attack"): "She lunges and stabs forward with her long knife in her RIGHT hand, the bow held "
                                       "in her LEFT hand down at her side.",
    ("flick-beschuetzerin", "crouch"): "Sneaking low, the bow held in her LEFT hand close to the ground, alert, the "
                                       "cloak pooled behind her.",
    ("flick-beschuetzerin", "sit"): "Sitting on the ground with one knee drawn up, her RIGHT forearm resting on the "
                                    "knee, the bow lying across her lap, relaxed and proud, a cheeky grin.",
    ("flick-beschuetzerin", "lie"): "Lying on her back resting with her hands folded behind her head, eyes closed, the "
                                    "bow lying beside her, the cloak spread beneath her. No blood.",
    ("flick-beschuetzerin", "hurt"): "She flinches, LEFT hand pressed against her RIGHT upper arm, teeth gritted, the bow "
                                     "still in her hand.",
}

PORTRAIT = (
    "Pixel-art dialogue portrait for an RPG (bust shot: head and shoulders down to mid-chest), three-quarter view with "
    "the face turned slightly toward the RIGHT, expressive face, detailed high-resolution pixel art with painterly "
    "pixel shading and a warm rim light, visible pixel grid, rendered in the same style as the attached portrait style "
    "reference (STYLE ONLY — do not copy that person's face, hair, clothes or age). Square image. The character must "
    "match the attached full-body reference sheet exactly (same face, hair, age, clothing, colours, accessories). "
    "Plain very dark neutral background (deep slate / charcoal with a faint green-blue tint), no scenery. Head and face CENTRED horizontally in "
    "the image and fully visible in the upper half, head not cropped at the top, shoulders reach the bottom edge. "
)

PORTRAIT_MOOD = (
    "Pixel-art dialogue portrait, a mood variant of the attached BASE PORTRAIT: keep EXACTLY the same character, face "
    "shape, hairstyle, clothing, colours, framing, head position, camera angle, lighting, pixel style and plain dark "
    "background as the base portrait — ONLY the facial expression (and at most a small head tilt or hand gesture) "
    "changes. Square image. "
)

MOODS: dict[str, str] = {
    "neutral": "Expression: calm and attentive, a faint thoughtful look.",
    "happy": "Expression: a warm genuine smile, bright eyes, cheeks lifted.",
    "sad": "Expression: sad, eyes downcast and glistening, inner eyebrows raised, lips pressed together.",
    "angry": "Expression: angry, brows furrowed hard, glaring, jaw clenched, nostrils flared.",
    "surprised": "Expression: surprised, eyes wide open, eyebrows raised high, mouth slightly open.",
    "determined": "Expression: determined, firm steady gaze, set jaw, a slight frown of resolve.",
    "hurt": "Expression: hurt and in pain, wincing with one eye squeezed, teeth gritted, a small scrape and a smudge "
            "of dirt on the cheek, a few loose strands of hair.",
    "pained": "Expression: exhausted and in deep pain from a wound, pale sweaty skin, eyes half closed, brows drawn "
              "together, teeth gritted, breathing hard.",
    "thinking": "Expression: thinking, eyes looking up and to the side, one eyebrow slightly raised, a finger touching "
                "the chin.",
    "scared": "Expression: frightened, eyes wide with fear, eyebrows pulled up and together, shoulders raised, lips "
              "parted.",
    "worried": "Expression: worried and anxious, brows knitted and pulled upward, eyes glancing to the side, lips "
               "pressed tight.",
    "ashamed": "Expression: ashamed and guilty, head slightly lowered, eyes cast down and away (avoiding the "
               "viewer's gaze), lips pressed together, a faint flush on the cheeks.",
    "smirk": "Expression: smug and mocking, a self-satisfied lopsided smirk or cold sneer, one eyebrow raised, eyes "
             "half-lidded.",
    "grim": "Expression: stern and severe, a cold disapproving gaze, brows lowered, mouth a hard straight line.",
    # Kyra under Vamir's spell (e2-kyra-gebannt): the glowing violet eyes and veins stay in every variant.
    "cold": "Expression: icy and inhuman, head tilted slightly to one side, the glowing eyes narrowed and fixed on the "
            "viewer, the faintest empty smile, the violet glow a little brighter.",
    "struggle": "Expression: her real self breaking through for a moment: brows drawn together in pain, lips trembling, "
                "a single tear on her cheek; the violet glow is FLICKERING and fading in her LEFT eye so her own warm "
                "brown iris shows through there, while her RIGHT eye still glows violet.",
    "devoted": "Expression: obedient devotion, head bowed slightly, the glowing eyes lowered, a serene empty half smile, "
               "the violet veins darker and the violet glow at its strongest.",
}

PORTRAIT_EXTRA: dict[str, str] = {
    "valentus-cloak": "Hood up, face partly shadowed by the hood but clearly readable.",
    "kyra-bound": "Show the rope around her wrists at the bottom edge if visible; cut above the LEFT eyebrow.",
    "e2-kyra-gebannt": "Keep the spell clearly visible: both irises glow cold violet (except where the expression says "
                       "otherwise), thin dark violet veins at the temples, cold violet rim light. No rope at her wrists.",

    "conspirator": "The face inside the hood is pure black shadow; only two small glowing red eyes are visible. No "
                   "nose, no mouth, no skin visible.",
    "orwen": "Stringy grey hair, gold brooch on the dark coat visible at the bottom.",
    "algard": "The scar is on his RIGHT cheek (on the left side of the image when he faces us).",
    "maedchen": "Completely bald head, rosy cheeks.",

    "alastir": "The large old burn scar covers the RIGHT half of his face, the side nearest the viewer, clearly "
               "visible.",
    "vamir": "NO FACE at all: inside the deep hood only pitch-black darkness, with a very faint cold VIOLET glow "
             "deep within the hood and thin wisps of black smoke; faint violet rim light on the folds of the black "
             "robe. Absolutely no turquoise.",
    "flick": "Her pointed elven ears must be clearly visible poking out of the short messy dark hair.",
    "elnon": "His long pointed elven ears clearly visible.",
    "baris-scarred": "Burn scar on the RIGHT half of his face (the side nearest the viewer), RIGHT eye milky white "
                     "and blind.",
    "logge": "The small round orange-tinted spectacles sit pushed up on his hair above the forehead, the white quill "
             "tucked behind his ear, the rust-orange tunic and pocketed leather vest visible at the bottom.",
    "sebastian": "The charcoal doublet, white shirt collar and small dark neckerchief visible at the bottom, the brown "
                 "leather strap of the lute crossing his chest diagonally and the top of the lute neck behind his "
                 "shoulder. NOT a wizard, no robe, no staff.",
    "pascal": "The woven straw hat with the green band on his head, the faded red shirt and the bright orange braces "
              "visible at the bottom. NOT a guard, no armour, no dark clothing.",
    "paladin-anfuehrer": "Bare head, NO helmet. The white tabard with the blue bird emblem and the dark-blue rank sash "
                         "visible at the bottom.",
    "paladin-jung": "Bare head, NO helmet, ginger hair and freckles clearly visible. The white tabard with the blue bird "
                    "emblem visible at the bottom.",
    "paladin-hauptmann": "Bald head, NO helmet, the scar through his LEFT eyebrow clearly visible, the deep-blue cape "
                         "and gold-rimmed pauldrons at the bottom.",
    "paladin-novize": "Bare head, NO helmet, dark curls. The quilted gambeson and the plain white tabard visible at the "
                      "bottom.",
    "paladin-wache": "Bare head, NO helmet, the long braid falling over her RIGHT shoulder, the white tabard with the "
                     "blue bird emblem visible at the bottom.",
    "goblin-ratz": "A comic goblin portrait, cartoonishly expressive but in the same painted pixel style; the huge ears "
                   "and the dented pot helmet clearly visible, the tip of the wooden spoon at the side.",
    "goblin-hotze": "A comic goblin portrait, cartoonishly expressive but in the same painted pixel style; the floppy "
                    "ears, round cheeks and the greasy apron clearly visible.",
    "goblin-fips": "A comic goblin portrait, cartoonishly expressive but in the same painted pixel style; the enormous "
                   "ears, the huge drooping nose and the three feathers in his hair clearly visible.",
    "flick-beschuetzerin": "Her pointed elven ears clearly visible poking out of the short messy dark hair; the "
                           "white-and-blue cloak with the round silver order brooch on her chest and the dark-green "
                           "leather shoulder piece visible at the bottom.",
}


def identity_refs(cid: str) -> list[Path]:
    """Reference sheets that define the character (own sheet first, base character second)."""
    from characters import ref_path  # late import to avoid a cycle
    c = char(cid)
    refs = []
    if ref_path(cid).is_file():
        refs.append(ref_path(cid))
    if c.get("base") and ref_path(c["base"]).is_file():
        refs.append(ref_path(c["base"]))
    return refs


def correction(extra: str) -> str:
    return f"\nIMPORTANT CORRECTION: {extra}" if extra else ""


def turnaround_prompt(cid: str, extra: str = "") -> str:
    c = char(cid)
    base = ""
    if c.get("base") and c.get("baseKeep") == "outfit":
        # Same uniform, different person (paladin-*): the base sheet only defines the equipment.
        base = (" The attached reference sheet shows ANOTHER soldier wearing the SAME uniform: copy the armour, tabard, "
                "cape, emblem, colours and weapon from it as closely as possible (except where the description says "
                "otherwise), but this is a DIFFERENT PERSON — the face, age, skin tone, hair, beard and body build must "
                "follow the description and must NOT look like the man on the attached sheet.")
    elif c.get("base"):
        base = (" The attached reference sheet shows the SAME person in another outfit: keep her/his face, age, body "
                "type, skin, eye colour and hair colour identical; only the outfit/hair styling changes as described.")
    return (TURNAROUND + "CHARACTER: " + c["desc"] + base + " " + PRIVACY + " " + MAGENTA + "\n" + STYLE + " "
            + PALETTE + " Match the pixel density and outline treatment of the attached small sprite reference." +
            correction(extra))


def walk_prompt(cid: str, extra: str = "") -> str:
    return (WALK + "The character must match the attached full-body reference sheet exactly (same face, hair, age, "
            "body type, clothing, colours, accessories).\nCHARACTER: " + char(cid)["desc"] + "\n" + MAGENTA + "\n"
            + STYLE + " " + NO_TEXT + correction(extra))


def sneak_prompt(cid: str, extra: str = "") -> str:
    return (SNEAK + "The character must match the attached full-body reference sheet and walk sheet exactly (same face, "
            "hair, age, body type, clothing, colours, accessories).\nCHARACTER: " + char(cid)["desc"] + "\n" + MAGENTA
            + "\n" + STYLE + " " + NO_TEXT + correction(extra))


def pose_prompt(cid: str, pose: str, extra: str = "") -> str:
    p = POSES.get(pose)
    if not p:
        raise SystemExit(f"unknown pose '{pose}' (known: {', '.join(POSES)}) — add it to POSES in scripts/art/prompts.py")
    tweak = POSE_EXTRA.get((cid, pose), "")
    return (POSE_PAIR + p["text"] + (" " + tweak if tweak else "") + "\nThe character must match the attached "
            "full-body reference sheet exactly (same face, hair, age, body type, clothing, colours, accessories).\n"
            "CHARACTER: " + char(cid)["desc"] + "\n" + MAGENTA + "\n" + STYLE + " " + NO_TEXT + correction(extra))


def portrait_prompt(cid: str, mood: str = "neutral", extra: str = "") -> str:
    m = MOODS.get(mood, f"Expression: {mood}.")
    add = PORTRAIT_EXTRA.get(cid, "")
    if mood == "neutral":
        return (PORTRAIT + "CHARACTER: " + char(cid)["desc"] + " " + add + " " + m + " " + PRIVACY + "\n" + STYLE
                + correction(extra))
    return (PORTRAIT_MOOD + m + " " + add + " CHARACTER (for reference): " + char(cid)["desc"] + "\n" + STYLE
            + correction(extra))


# --------------------------------------------------------------------------------- other asset kinds
BACKGROUND = (
    "Wide 16:9 game map background for a 2D story RPG, high three-quarter top-down oblique camera (about 45 degrees, "
    "like the attached landscape references), painted pixel art. The ground area must be open and readable so small "
    "characters can walk on it; no characters, no people, no animals unless stated. Scene: "
)
PROP = (
    "Single game prop sprite for a 2D pixel-art RPG, seen from the same high three-quarter top-down camera as the "
    "attached landscape reference, drawn as one isolated object, centred, filling about 70% of the image, with an "
    "empty margin all around, nothing cut off. Object: "
)
PLATE = (
    "Cinematic 16:9 story illustration (storybook plate) for a fantasy RPG, painted high-detail pixel art with soft "
    "painterly pixel shading, dramatic but warm lighting. Characters, if any, must match the attached reference sheets "
    "exactly and must not resemble any real person or actor. Scene: "
)
ICONS = (
    "Inventory item icon sheet for a fantasy RPG: a strict grid of {cols} columns x {rows} rows of separate item icons, "
    "each item centred in its own invisible square cell with wide empty gaps, nothing touching, every icon drawn large "
    "and bold so it stays readable at 32x32 pixels, slight three-quarter view, chunky pixels with a bold dark outline, "
    "warm soft lighting. Items in reading order (left to right, top to bottom): {items}. "
)


def background_prompt(desc: str, extra: str = "") -> str:
    return BACKGROUND + desc + "\n" + STYLE + " " + PALETTE + " " + NO_TEXT + correction(extra)


def prop_prompt(desc: str, extra: str = "") -> str:
    return PROP + desc + "\n" + MAGENTA + "\n" + STYLE + " " + NO_TEXT + correction(extra)


def plate_prompt(desc: str, extra: str = "") -> str:
    return PLATE + desc + "\n" + STYLE + " " + PALETTE + " " + NO_TEXT + correction(extra)


def icons_prompt(items: list[str], cols: int, rows: int, extra: str = "") -> str:
    return (ICONS.format(cols=cols, rows=rows, items="; ".join(f"{i + 1}. {t}" for i, t in enumerate(items)))
            + MAGENTA + "\n" + STYLE + " " + NO_TEXT + correction(extra))


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__)
        raise SystemExit(2)
    kind, cid = a[0], a[1]
    fn = {"ref": lambda: turnaround_prompt(cid), "walk": lambda: walk_prompt(cid),
          "pose": lambda: pose_prompt(cid, a[2]), "portrait": lambda: portrait_prompt(cid, a[2] if len(a) > 2 else "neutral")}
    print(fn[kind]())

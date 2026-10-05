# Kritik: art

I reviewed the art library on port 5351 through the builder's standalone gallery (`game/e2e/scratch-art/gallery.html`). The real game entry still returns HTTP 500 because `src/ui/index.ts` imports a missing `./rotate`, so the `art-gallery` scene inside the actual game was never tested. My own paths type-check clean, the 18 Vitest tests pass, there were no console errors, and character privacy (no film likeness) is respected. To look at the art I dumped every character and prop texture and viewed it at 3–6× zoom, and took screenshots of all 8 gallery pages at 1280×720, 390×844 and 844×390 with touch emulation.

Performance is fine. Startup takes about 7 ms, all 61 character sheets plus every prop build in about 0.5 s, and the 48×30 map builds in about 150 ms.

Overall it is well above programmer art. The farmhouse, campfire, forge, tents, trees, crop beds, icons and the portrait set read as a coherent cozy pixel style. But several highly visible pieces still look unfinished or wrong:
- **Pond water:** the shallow edge looks like ice.
- **Wheat:** it reads as static noise and cannot hide anyone walking through it.
- **Interiors:** there is no wall tile and the gallery's interior page has no furniture.
- **Character motion:** the front-facing walk barely moves, and hit and kneel look almost like idle.
- **Cradle babies:** the key prologue prop shows two blurs instead of babies.
- **Missing content:** there is no rider-on-horse sprite at all.
- **Prop data:** a few fields chapter authors need are missing, such as several collision boxes per prop and a walkable area for bridges.
- **Off-palette or off-style pieces:** about 300 colors instead of the 40–56 the design asks for, an American-style red barn, and a white marble pillar among grey ruins.

The findings below are ranked by impact; I edited no game files. Screenshots and crops are in `/private/tmp/claude-501/-Users-logge-Documents-Projects-SelantisRPG/37c18062-7742-4541-8f98-1c3694f6e7e6/scratchpad/shots/`, and my scratch scripts are in `/Users/logge/Documents/Projects/SelantisRPG/game/e2e/scratch-review-art/` (gitignored). The dev server is stopped.

## 1. [critical] Shallow water reads as ice; the pond has no believable shoreline or depth

In `tiles/ground.ts` (`shallow` and the water edge), the ford ring is a pale, washed-out cyan (water ramp steps 6–7, 0xa6d8e6/0xe4faff) with a white rim against the grass. At 1–1.5× the pond looks frozen (see `pond1.png`). The step from shallow to deep is a hard checkerboard dither band, and the deep part is one flat 0x22487e with scattered white dashes.

Fix:
- Draw shallow in water ramp steps 3–5, tinted toward teal, and let pebbles or sand show through at about 30%.
- Replace the white rim with a 1–2 px dark wet-earth bank (mud ramp 1–2) on the grass side, plus a thin animated foam line one pixel inside the water that only appears every few pixels.
- Fade depth over 3–4 px using ramp steps 2→3→4 with an ordered dither, not a single checker row.
- Add slow horizontal ripple highlights and dark reflection bands under the north bank and under reeds.

The pond appears in several chapters (ford, lake), so this is the most visible ground problem.

## 2. [critical] No interior wall terrain, and the gallery's interior page has no furniture

`TerrainId` has no wall, and `cliff` renders as a flat grey masonry texture with no height, top cap or base shadow (`int2.png`). The interior gallery page (`buildInterior`) shows only floor tiles; not one of the 20+ furniture props is placed, so the tavern and farmhouse interiors (DESIGN §3: Taverne innen, Bauernhaus) were never judged.

Fix:
- Extend the contract additively with `'wall' | 'wall-timber' | 'wall-stone'` terrains. Autotile each as a 2-tile-high front face (plaster or planks with a dark timber sill and beam, 1 px light top cap) where the tile below is floor, and as a dark top surface everywhere else, with a soft 3 px contact shadow cast onto the floor.
- Or provide `wall-front` props in 16 px segments plus corner pieces.
- Then build the Goldener Eber in `buildInterior`: counter, posts, fireplace, round tables, stools, kegs, candles, door, window, rug.

This is the template chapter authors will copy.

## 3. [major] Front and back walk cycles barely move; arms never swing

In `characters/rig.ts`, the walk pose only offsets the feet in x (`nx = [3,1,-1,-3,-1,1]`) and lifts them by at most 1 px. Seen from the front or back, x offsets of the feet are invisible, so walking down or up is close to static (`walk6.png`: all six front frames almost identical). Arms offset by `nx*0.7` in x, which also does nothing in the front view.

Fix for the front and back views:
- Alternate the leg *length*: the stepping leg is 1–2 px shorter (lifted) and its foot drawn 1 px lower or higher.
- Swing the arms vertically (hand y ±1–2 px), with the opposite arm and leg moving together.
- Use a 2-frame bob: down on the contact frames 0 and 3, up on the passing frames.

For the side view, separate the near and far legs by colour (far leg one ramp step darker) so the scissor motion reads, and swing the near arm ±2 px. Do the same for run (bigger lift) and sneak.

## 4. [major] Hit, kneel and interact poses are nearly indistinguishable from idle

In `misc6.png`, `hit:down` frames 0–1 equal idle with a tiny white sparkle, `kneel:down` is idle moved 2 px lower, and `kneel:right` looks like idle. The tactics battles and story staging rely on these poses.

Fix:
- hit: frame 0 head and torso pushed back 1–2 px against the facing direction, eyes 'hurt', arms flung outward. Frame 1 bends forward. Optionally bake a 1-frame white silhouette as an `hit-flash` extra.
- kneel: one knee on the ground — near leg folded (thigh horizontal, 3 px), far shin flat on the ground, torso lowered 5–6 px, head bowed 1 px.
- interact: reach forward 3–4 px with the near arm extended, torso leaning 1 px.

## 5. [major] Wheat cannot hide characters and reads as noise

In `tiles/ground.ts` (`buildGroundObject`), the wheat overlay is added inside the ground container, so every character and prop draws on top of the wheat heads; tall wheat can never cover legs. Up close (`gz-field.png`) the field is random vertical strokes with no ears, no row structure and no top edge. It also ends in a hard rectangle with a 2 px brown border, like a carpet.

Fix:
- Return the wheat (and any tall-plant) overlay as a separate y-sorted layer. Additive suggestion: `container.getData('foreground'): Phaser.GameObjects.Image[]`, each with depth set to its row bottom, so the world can sort characters into it and the lower body gets hidden.
- Redraw the wheat as staggered rows of stalks with 2–3 px golden ears (straw ramp 3–5) and a light top-left rim, plus a darker shadow band at each row base.
- At the field edges, add a ragged 2–3 px fringe of single stalks spilling onto the neighbouring terrain instead of the straight border.

## 6. [major] cradle-twins: the babies are unreadable

In `props/furniture.ts` (cradle), the two babies are two 3–4 px orange-pink smudges that look almost the same as the empty cradle (`m-zoom.png`). This is the key prop of the prologue (light above the cradle, the twins being separated).

Fix:
- Enlarge the cradle to about 28×22.
- Draw two swaddled bundles in cream and linen, each with a 4×4 face (skin ramp, two closed-eye dark pixels, a 1 px blush).
- Give one a reddish curl (strawberry ramp, Lia) and one a brown curl (nut ramp, Kyra), with a blanket edge across both and a small rocking curve under the cradle.
- Optionally add a 2-frame breathing animation (blanket rises 1 px).

## 7. [major] No mounted riders and weak horse readability

`shadow-rider` is just a soldier on foot with a cloak; there is no horse-plus-rider sprite, yet the story needs the kidnap ride, Kyra on horseback and rider patrols. The horse's front and back views are a brown box on four sticks, and in the side view the neck is a thin vertical stalk with a tiny head (`animals.png`). The deer's white belly band and stick legs make it read like a stool.

Fix:
- Add an additive API `mounted(scene, riderId, horseVariant?)` that returns a key with idle, walk and run in 4 directions (rider drawn seated on a horse layer, legs over the flanks, rider bobs 1 px out of phase), plus a `rider-bound` variant for Kyra.
- Redraw the horse: thicker arched neck (4–5 px), larger wedge-shaped head, mane and tail in a darker ramp, front view showing the chest and head foreshortened instead of a flat rectangle.
- Deer: drop the hard belly band, taper the legs, add a white tail patch.

## 8. [major] Palette is about 300 colours, not 'one fixed palette of about 40–56'

`palette.ts` defines 55 ramps of 5–8 colours each, with many near-duplicates: brown/nut/wood/earth/leather, grey/ash/stone/steel/iron, green/grass/olive/forest. Combined with dithered `tone()` gradients, this makes some props look softly rendered rather than hand-pixeled: the canopy of `tree-big` is smooth spheres, `rock-big` is a shiny white egg, the ruin pillar is bright marble.

Fix:
- Consolidate to about 12–14 master ramps per DESIGN §3 (earth, wood, 4 greens, water, night violet, 3 skins, hair hues, cloth, steel, gold, turquoise).
- Alias the old names onto them.
- Optionally add a nearest-palette quantize pass in `Px.toCanvas()` behind a flag, so every prop, tile, character and portrait shares exactly the same colours.

## 9. [major] Night lighting metadata blows out facades and fires

`house-farm-night` puts its main light at the door (`offsetY -14`, radius 54) and both window lights on the facade (y -20), so additive glows turn the whole plaster wall yellow-white (`nz-house.png`). The campfire light (radius 80) adds onto an untinted, already-bright fire sprite, so the fire and the seated `valentus-cloak` become a white blob (`nz-fire.png`).

Fix:
- Move the window lights onto the ground in front of the house (y +6 to +10) and document in `PropInfo.lights` that positions mean 'where the light pool lands'.
- Use a smaller emissive radius for the window itself.
- Lower the peak alpha of the `fx-light-warm` texture to about 0.55 at the centre with a flatter core.
- Have the gallery (the reference for the world area) scale lights by radius/64 at 0.5 alpha, so world authors copy sane values.

## 10. [major] Missing collision and placement data authors need (arch, bridge, seats)

`PropInfo.footprint` allows a single box. `ruin-arch` therefore blocks its full 48 px width, so nobody can walk through the arch. `bridge-h` has footprint `null` and no walkable area, so the world cannot know the bridge deck overrides water collision. Tables and the counter have no `seat` or `serve` anchors, and the watchtower has no climb or top point.

Additive contract fix:
- `footprints?: {x,y,w,h}[]` (arch = two pillar boxes; pigpen = four fence sides so the pig can be inside).
- `walkable?: {x,y,w,h}` for the bridge deck, with railings as footprints.
- Anchors: `seat-0..n` around `table-round`, `table` and `council-table`; `serve` behind the counter; `top` on the watchtower; `hang` on the weapon rack.

## 11. [major] Farm buildings off-style: American red barn, weak half-timbering, low walls

`barn` is a classic US red barn with white X-braced doors, which clashes with the medieval European setting. On `house-farm`, the Fachwerk is a single sagging diagonal line that reads as bunting, not timber framing. Its walls are only about 30 px high with a 19 px door, so the 21 px characters are taller than the door, and the roof covers about 65% of the sprite.

Fix:
- Barn: dark timber frame with plaster or vertical weathered planks (wood ramp 2–3), a thatched or hip roof matching the house tiles, a big plank double door with iron strap hinges.
- House: dark 2 px beams — sill, top plate, posts every 16 px, St. Andrew's-cross braces under the windows.
- Raise the walls to about 40 px and the door to at least 24 px, and trim the roof height accordingly.

## 12. [minor] Portraits share one face template; villains are not menacing

Kyra is Lia with brown hair, and Craupor and Maedchen are nearly identical bald heads. Orwen reads as a mild old woman — no hollow cheeks, sneer or yellow teeth (DESIGN: cold, mocking). Baris's buzz cut renders as a bald orange dome and his beard as a grey box like a balaclava. Flick's fringe draws dark horizontal stripes across her eyes. Neutral, determined and thinking are almost identical for most characters.

Fix:
- Add face-shape parameters to the spec (jaw width, cheekbones, nose length, eye shape, age lines) and vary them per preset.
- Orwen: narrow eyes, hollow cheek shadows, thin asymmetric smirk with 2 yellow teeth pixels.
- Baris: 1 px black stubble texture over the whole scalp, beard drawn as curly clumps with a highlight, heavy brow.
- Flick: shorten the fringe so both eyes are clear.
- Make 'thinking' look aside with one raised brow, and 'determined' use lowered lids and a tight mouth.
- Drop the manga anger-vein symbol; it is off-tone for the melancholic chronicle.

## 13. [minor] Several icons are ambiguous or duplicated

In `icons.ts`:
- `tinder` is a round sack with a burning fuse, i.e. a cartoon bomb. Draw a flint plus steel striker, or a small tinderbox with a curl of char-cloth.
- `dagger` and `sword` are nearly identical diagonal blades. Make the dagger a short, wide leaf blade with a small guard and a wrapped grip, centred.
- `coins` reads as a barrel plus one coin. Draw a 3-coin gold stack with a highlight and one coin standing.
- `bacon` reads as a candy ribbon. Use a slab with fat streaks and a rind edge.
- `eye` uses the turquoise Urmacht colour, which is reserved for magic; use green or brown.
- `waterskin` looks like a clay pot; give it a leather bladder shape with a cord and stopper.

## 14. [minor] Gallery bugs and usability problems

In `GalleryScene.ts`:
- The anims page label says „(←/→ wechseln)“, but the arrows pan the camera and switching is bound to `,` and `.`. Change the text to „(,/. wechseln)“ or bind Q and E.
- The tab bar wraps „8 Symbole & Effekte“ onto three lines at 1280 px and overflows off-screen on a 390 px phone. Use `white-space:nowrap; overflow-x:auto; max-width:calc(100vw - 16px)`.
- There is no zoom on touch; add pinch or on-screen +/- buttons.
- On the props page, rows are sized by the tallest item, so most of the screen is empty grass. Group by category with captions (Natur, Hof, Lager, Innen, Ruinen).
- On the night page, characters are tinted 0x8a96c8 but props 0x5a66a0, so the people glow.
- Portrait rows misalign when a name wraps; give `.name` a fixed width with `white-space:nowrap`.
- Characters in the gallery have no `fx-shadow` under them, so they float. Add it, since this is the reference world authors copy.

## 15. [minor] Smaller sprite and prop polish

- Lia's front hair has two upward spikes at the top corners that read as cat ears or horns in every front frame; round the updo into a single bun at the back.
- Lia's brown skirt is a 2–3 px band that reads as shorts; extend it to the ankles (DESIGN: brauner Rock).
- The stump top and log end are saturated yellow (straw 4–5); use wood ramp 4–5 with ring lines.
- `rock-big` variant 0 is almost white; darken it to stone ramp 2–5 and add moss or lichen.
- `ruin-pillar` is pure white marble; use the same warmstone as `ruin-wall`.
- `council-seat` looks like a grey block with a blue cushion; add carved armrests, a high back with the star sigil, and steps.
- `stairs` is a striped box; draw step treads with shadowed risers and side stringers.
- Weapons (Baris's axe, Azar's scimitar) are 1 px lines; give axe heads at least 4×5 px with a steel highlight.
- Vamir's smoke wisps are black on a black robe and invisible; use coal or violet ramp 1–2 at 60% alpha, animated.

## 16. [minor] Banner colours conflict with DESIGN

`banner-falcon` is blue-yellow with a yellow bird, which follows the area brief. DESIGN §3 says the Army of Light's banner is blue-white with a white bird of prey; blue-yellow is Portas and Foltan's tabard. Keep `banner-falcon` (Portas Falken) and add an additive prop `banner-light` (blue-white, white raptor, gold finial) so the prologue battle can show both forces correctly. Also add a version of `fallen-banner` for each faction.

## 17. [minor] Not verified in the real game; API edge cases

The `art-gallery` scene has never run inside `main.ts`: the UI area's missing `./rotate` module still gives HTTP 500. Re-test with `?scene=art-gallery` once the UI compiles, because `startGallery` calls `G.ui.setHud('none')` and the gallery overlay sits at z-index 50 over the UI root.

API edge cases:
- `character(scene, spec, customKey)` returns the cached texture when the same `customKey` is reused with a different spec; `customCounter` is never incremented. Either document that, or regenerate when the spec hash differs.
- `characterSize()` silently returns 24×24 for unknown keys; warn once instead.
- `buildGround` water and wheat run on `scene.time` events, so a scene that pauses its clock for cutscenes freezes the water. Mention this in `api.ts`, or expose `container.getData('setAnimating')`.

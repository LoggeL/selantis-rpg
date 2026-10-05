# Kritik: world

I reviewed the world engine at 1280×720 and 844×390/390×844 with touch emulation, by keyboard, mouse click and tap. I read all of world/*, the dev-world chapter and world-guide.md. The engine is solid and well past programmer art: lighting, the campfire glow, the night clearing, the big E hint, Spurenblick and the guide all hold up. tsc shows no world errors, the 38 Vitest tests pass, the stress map runs at 60 FPS and no run logged a console error. A long cross-map path takes about 14 ms, which is fine. I found two engine bugs and confirmed them in a running game: an item can be picked up again after leaving and re-entering a map, and a script hangs forever after a companion is removed. I also confirmed (code or screenshots) a stale speech-bubble bug across map changes and several visual problems that matter a lot. The companion stands on top of Lia. Vision cones are drawn over trees, roofs and actors. Wheat does not hide anyone visually. Dusk looks like olive daytime. Stopping rain is a hard cut, and the 'spotted' moment is weak and partly hidden. Two things I could not test reliably: the e2e page reloads whenever other agents edit files (fixed by running with HMR off), and I tested a door exit only on a map I built in the console. Cross-area wish: after switching phone orientation portrait→landscape, the canvas stays 390 px wide (Phaser scale setup in main.ts or core, not world). My scratch scripts are in game/e2e/scratch-review-world/; screenshots were deleted and the server on port 5353 is stopped.

## 1. [critical] Map state resets when you come back to a map: items can be picked up twice, triggers and lighting reset

Confirmed: I picked the apple (inventory dev-apfel:1), changed to world-demo-2 and back. 'apfelbaum' was enabled again and E gave dev-apfel:2. Cause: changeMap → teardownMap/buildMap rebuilds everything from the MapDef, so `used`/`removed` interactables, `done` once-triggers, removed props, found clues without `clue`, and script-set lighting/weather (the 'nacht' trigger → back to 'dusk') all reset. Fix: keep a `mapMemory = new Map<mapId, { used:Set<string>; triggersDone:Set<string>; removedProps:Set<string>; foundClues:Set<string>; time?:TimeOfDay; weather?:WeatherKind }>` on WorldScene. Write to it in interact()/removeProp()/updateTriggers()/lighting.set()/weather.set(), and apply it in buildMap after creating objects. Persist it into G.state (e.g. flag `world.mem.<mapId>` as JSON) so it survives save/continue. Document it in world-guide.md, and add `MapDef.resetOnEnter?: boolean` for maps that should reset.

## 2. [critical] w.companions.remove(id) freezes the actor, and any later walkTo on it never resolves

Confirmed: after `w.companions.remove('flick')`, `w.actor('flick').walkTo(x+3, y)` stayed unresolved after 2.5 s and x did not change. removeCompanion() only sets kind='npc'. The actor is then in neither companionDefs nor npcDefs, so nobody calls a.update() and followPath never runs (the comment at WorldScene.ts:882 says such actors 'still animate', but there is no code for it). A chapter script that parts with a companion hangs forever. Fix: in removeCompanion, register an NpcDef ({ id, preset, at: current pos }) plus npcTimers so updateNpcs drives it. Or, simpler, add a pass at the end of update(): `for (const a of this.actors.values()) if (!updatedThisFrame.has(a)) a.update(dt)`. Same check for actors whose npcDefs entry was removed in addCompanion.

## 3. [major] The companion stands on top of the player and covers her

Seen in many screenshots (start, house, Kyra talk, stump 'Hinsetzen'): Flick stops 18 px directly behind Lia along the trail and has the larger y, so he is drawn over Lia's lower half or more. Walking north or talking to an NPC from below gives an unreadable column of three sprites, and Lia is often almost invisible. Fix: (1) raise the follower spacing to 24 px (`18 + i*17` → `24 + i*20` in updateCompanions/placeCompanionsBehind/addCompanion). (2) When the player is idle, move the companion's slot 10–12 px sideways relative to the player's facing direction (a formation offset), checked with grid.boxFree. (3) Give the player a depth bias (`sprite.setDepth(y + 2)` for kind 'player') so Lia wins ties when the sprites overlap. (4) During interactions and cutscenes, hold the companion where it is instead of pulling it to the slot.

## 4. [major] Vision cones are drawn above trees, roofs, tents and characters, with visible banding and a hard outline

coneGfx is an overlay-camera object at depth 100, so the cone covers canopies (bottom-right pines in the camp shot), the tent and actors, ignores the lighting multiply, and stays bright yellow during Spurenblick. Three nested polygons give two clear bands, and the 1 px rim stroke reads as debug art. Fix: draw the cone in the world camera at a ground depth (e.g. −150, above shadows and below every prop and actor) so occluders cover it. At night, keep it readable with a second ADD copy at low alpha or by raising the base alpha by darkness. Replace the three bands with a radial gradient: stamp the polygon into a small RenderTexture masked by a 'w-light'-style falloff, or use about 6 steps with alpha easing. Drop the stroke, or reduce it to a 1 px tip arc only. Multiply the cone alpha by (1 − look.amt*0.6) so Spurenblick stays clean.

## 5. [major] Speech bubbles survive map changes and stick to destroyed actors

In the transition frames, Flick's bark „Hübscher Hof. Ruhig hier.“ stayed on screen through the black fade and into world-demo-2, at a stale position. barkActor's anchor checks `a.visible && this.alive`, but Actor.destroy() never sets visible=false. Fix: set `this.visible = false; this.destroyed = true` in Actor.destroy() and return null from the anchor when destroyed. Also keep all bark removers in a Set on WorldScene and call them in changeMap() before the fade, in spotted() and in onShutdown(). Guard barks (stealth.ts bark()) need the same treatment; see the next finding.

## 6. [major] The 'spotted' moment is weak, and the old suspicious bark hides the guard's '!'

In the spotted sequence the guard's „Hm?“ bubble (scheduled 950 ms after '?') stays for 1.8 s and covers the '!' emote at the exact moment of detection, because DOM bubbles sit above the canvas. Apart from that, the alert is a 0.08 zoom punch and a hop: no flash, no hit-stop. That is below the 'Juicy' pillar in DESIGN.md §1. Fix: keep the remover returned by G.ui.bubble in Guard and call it on 'alert', 'calm' and reset(). On alert, add a 120–150 ms hit-stop (freeze actor updates), a short red vignette pulse (reuse vignetteFx with a red-tinted overlay or lighting.flash(0xd4573b, 250)), turn the guard's cone red with a quick scale pulse, then fade. Respect reducedMotion for any punch or shake.

## 7. [major] Wheat is meant to hide you but looks like a carpet

Sneaking in the wheat field sets alpha 0.6, but Lia is drawn fully on top of the wheat tiles, so being hidden has no visual payoff and walking through wheat looks wrong. Fix: when an actor's feet are on 'wheat' (also tall-grass hide props), hide the bottom 7–9 px of the sprite with sprite.setCrop(0, 0, w, h−k) plus a matching shadow hide. Draw 2–3 small stalk sprites at depth actor.y+1 in front of the legs (procedural 'w-wheat-front' texture in textures.ts, or ask the art agent for a 'wheat-front' prop) that sway with wind and shake on movement (rustle). Do this for NPCs and guards too, so guards wading through the field also sink in.

## 8. [major] Dusk looks like olive daytime

MOODS.dusk multiplies by [0.94, 0.66, 0.52]. On a green-dominant map this turns the grass olive-yellow without darkening or adding evening contrast (start screenshot vs. the night shots). Fix: make dusk a two-part grade. Use an overall luminance around 0.72, multiplied by a vertical or diagonal gradient (warm 0xffb070 top-left, the light side in DESIGN.md §3, down to a cool violet 0x6a5a9a bottom-right), built like the haze texture but as a multiply layer. Push 'add' a little toward magenta (0.08, 0.02, 0.06). Optionally add long shadows: stretch the 'w-shadow' images 1.6× toward the bottom-right when time is dusk or dawn. Check it side by side with day.

## 9. [major] Turning weather off is a hard cut; changing rain → storm resets the rain

Weather.set() calls teardown() at once and only ever fades in (targetLevel = 1). weather.set('none', {ms:1800}) makes all rain, splashes and fog vanish in one frame, which the brief forbids ('NO hard visual cuts'). Switching rain → storm destroys the drops and fades back in from level 0. Fix: keep the old particle set as an 'outgoing' layer whose level fades to 0 over ms before it is destroyed. Reuse the existing drop pool when moving between rain and storm and only change the count, slant and wind. Also: the rain reads thin (140 one-pixel streaks), so add 1-frame ground ripples on water and darker wet ground (a multiply of about 0.9 on the grade, already in WEATHER_TINT, but only applied while the RT is visible; make sure it also applies at 'day'). Desaturate or dim the rain while look.amt > 0 (a known gap).

## 10. [major] No way for an interaction to put the player at a fixed spot (sit, kneel at a clue, use a door)

In world-demo-2, 'Hinsetzen' plays 'sit' wherever Lia happens to stand, in front of the stump, with Flick stacked on top. Chapter scenes will often need 'sit on the bench', 'kneel at the grave' or 'stand at the door'. Contract addition (non-breaking): add `InteractableDef.standAt?: At | { anchor: string }` and `face?: Dir`. Before run(), walk the player there (scripted path, ~200 ms) using PropInfo.anchors (art already exposes 'sit', 'door', 'seat'). Add `ActorHandle.walkTo(target, { anchor: 'sit' })`, and park companions 2 tiles away during the interaction. Use it in the demo stump and document it in world-guide.md.

## 11. [minor] Fireflies render as hard plus-shaped crosses

In world-demo-2 the 44 fireflies look like UI sparkles ('+' glyphs) rather than soft glowing insects, which weakens the Urmacht motif the design leans on. Fix: give w-firefly a 1–2 px warm-green core and add an ADD 'w-glow' halo at scale ~0.12 and alpha 0.35, pulsing with the same phase. Make the near-layer motes slightly larger and blurrier, and add a small vertical bob. Keep the slight attraction to Lia.

## 12. [minor] Clicking deep into a large pond does nothing

findPath uses nearestWalkable(goal) with maxRadius 24 cells (96 px). On world-stress, a click at the pond centre returns null, so the player gets no movement and no marker. Fix: when the goal search fails, march from the target toward the player in 4 px steps to the first walkable cell, or raise maxRadius to 64 for goals. Always show a small 'blocked' marker so the click visibly registered.

## 13. [minor] Mashing through dialogue reopens the NPC conversation

An Enter press about 450 ms after the last line closed started Kyra's repeat line again (my scripted run hit this). The only guard is `queued > lastLockedReal + 150`. Players mash to skip, so re-interacting with the same target needs a stricter rule. Fix: after a dialogue or interaction ends, require the action key to be released and pressed again AND wait ≥ 350 ms before re-triggering the same interactive id. Different targets can stay at 150 ms.

## 14. [minor] Ambient particles and butterflies drift outside the map into the black void

On a map smaller than the viewport (the door test, 18×12 tiles), butterflies flew over the black margin. Motes and critters wrap around cam.worldView, not the map. Fix: clamp the wrap and anchor rectangle to the intersection of the view and [0, 0, mapW, mapH]. For maps smaller than the viewport, consider filling the margin with a darkened vignette of the edge terrain instead of pure #07080c.

## 15. [minor] Smaller polish items

(a) The world objective marker can sit under the HUD buttons: `inside` uses a 12 px margin, so keep about 34 px clear at the top-right and 70 px at the top-left (or ask the UI for a safe-area rect). (b) Shadows (w-shadow) look linear-filtered and blurry next to crisp pixel art; use a hard 2-tone pixel ellipse. (c) `stealth.checkpoint(At)` cannot set a facing; add `checkpoint(at, dir?)`. (d) A* allocates three n-sized typed arrays per call; 24 wandering NPCs on world-stress produce several MB of garbage per second, a GC risk on phones. Pool them per grid with a generation stamp. (e) `w.on()` handlers registered in onEnter pile up on every re-entry; document this or return auto-disposed subscriptions per map.

## 16. [minor] Demo and guide hard-code keys and use a hedge wall of hide bushes

The demo narrator says „Halte C gedrückt …“ and „Halte Q gedrückt …“ even on touch, where the buttons are „Schleichen“ and a look button. Offer `w.controlHint('sneak' | 'look' | 'interact')`, which returns „C“ or „den Schleichen-Knopf“ depending on isTouch, and use it in the demo and guide. The 13-tile vertical column of 'bush-hide' at x=30 looks like an artificial hedge wall. Since chapter writers copy the demo, scatter 4–6 hide bushes in clusters with jitter, mixed with tall-grass.

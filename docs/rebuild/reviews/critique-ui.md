# Kritik: ui

I reviewed the UI area on port 5352 (server stopped afterwards). I took about 60 Playwright screenshots at 1280×720, 1920×1080, 844×390 and 390×844 with touch, drove every demo step by keyboard, mouse and touch, and read every file in ui/**, scenes/**, dev-ui and the CSS. My scratch scripts are in /Users/logge/Documents/Projects/SelantisRPG/game/e2e/scratch-review-ui/ and screenshots in its out/ folder. Type-check is clean for the UI paths, the 9 Vitest tests pass, the title backdrop runs at about 59 fps, and there are no console errors apart from WebGL driver warnings.

Overall it looks polished and consistent, not like programmer art. The night-blue and gold panels, the parchment surfaces and the Cinzel/Alegreya type read as one system. The best parts are the chapter card book, the journal as a two-page book that becomes a stacked page on phones, the settings page, the large E hint and Mother's map plate. The title screen is atmospheric but dark and sparse. Its mountain ridge highlight is a 1px stepped line that floats apart from the mountain body. Portraits and item icons still show the art stub's placeholder squares, which is not the UI's fault.

The two critical problems are robustness, not looks: a tap on touch picks a choice blindly, and old scene scripts keep driving the UI after leaving to the title or warping. Several other problems were reproduced, not guessed: Enter-mashing picks the first choice, burst toasts are lost, the hold-ring hand icon is turned sideways on touch, the title menu is clipped in phone landscape, dev saves show up as "Fortsetzen", and the dev chapter's sample entries leak into the real journal. German text is correct throughout: umlauts, „…“ quotes, natural phrasing.

## 1. [critical] Touch: the tap that ends a line also picks the choice under the finger

Reproduced in s-ghost.mjs (touch mode). When Kyra's line is complete and the player taps where choice 1 will appear, advanceGate closes on pointerdown, choose() renders straight away, and the browser's follow-up click lands on the .choice button. NavList's click handler then calls pick(0) with no time check. Result: the dialogue jumped to „Das sagst du jedes Mal …“ without the player ever seeing the options. With a mouse the same test did not pick anything. Fix in dialogue.ts and nav.ts: a choice row should only activate on click when its own pointerdown happened after the list opened and after its entry animation (about 350 ms after openedAt). The cleanest way is to record the pointerdown target on each row and activate on pointerup or click only if it matches. Add this case to e2e/scratch-ui/input-test.mjs.

## 2. [critical] Old scene scripts keep showing UI after „Zum Titel“ or a warp

Reproduced in s-stale.mjs: start ?scene=ui-demo&step=toasts, then Esc → Zum Titel. Item, memory and lore toasts from the old scene then appear over the title. About 10 s later the old script's next step turns on the letterbox and opens a narrator dialogue on top of the title menu (st03-title-later2.png). Its advanceGate also pushes a modal above the title, so Enter now advances the old line instead of choosing a title item. The same happens on an F2 warp in the middle of a script. reset() clears the DOM, but nothing stops scripts that are sleeping or waiting on the world. Fix in the UI: keep an epoch counter in ctx that reset() and showTitle() increase. While ctx.has('title') is true, say/choose/narrate/think/hold/plate/chapterCard/caption should return a promise that never resolves and render nothing, and letterbox(true), bubble, hint and non-info toasts should be ignored. Also mute state-event toasts from reset until the next scene:goto, not just for 1.5 s. Request for core: a scene token that goto/warp increase, plus a G.wait(ms) that never resolves once the token has changed, so chapter scripts stop at their next await. Document this in ui-guide.md.

## 3. [major] Mashing Enter through dialogue picks the first choice blindly

choose() only ignores confirm keys for 120 ms after opening (dialogue.ts, `performance.now() - openedAt < 120`). The rows fade in with a delay of 60 + i·55 ms, so a player pressing Enter twice about 300–400 ms apart to skip text picks option 1 before it is fully visible. My own scripted runs hit this twice (d09 and c02 show Kyra's reply to option 1). That breaks the brief's rule that early input must never skip anything unseen. Fix: ignore confirm keys and number keys until the last row's animation has finished (about 60 + n·55 + 200 ms) or at least 350 ms have passed. Also ignore a press whose keydown started before the list opened, by tracking held confirm codes in ctx.held at open time.

## 4. [major] Toasts are thrown away in bursts: an ability toast never appeared

ToastUi.show() removes the oldest toast at once when more than 4 are on screen (`while (children.length > 4) firstElementChild.remove()`). In the demo's toast step, six events arrive in the same tick. „Hinweis notiert: Frische Hufspuren“ and „Neue Fähigkeit: Spurenblick“ were removed before they could be seen (t04-toasts-many.png), and 4–6 sounds played on top of each other. Fix: add a queue in toast.ts with at most 3 visible, a new toast every 350–450 ms, and older ones leaving with their exit animation instead of being cut. Group items that arrive within the same 300 ms (e.g. „Honig-Apfelkuchen, Kupfermünzen ×22“) and play one sound per group. Rank ability and objective toasts above item toasts.

## 5. [major] Hold ring: the touch hand icon is turned 90° and stretched

In styles.css, `.hold-ring svg { position:absolute; inset:0; width:100%; height:100%; transform: rotate(-90deg) }` also matches the hand icon inside `.hold-key`, because that icon sits inside the ring. On every touch device the hand in the „Halte still“ prompt lies sideways and fills the ring (ht02-holding.png, l06-hold.png). Fix: change the selector to `.hold-ring > svg`.

## 6. [major] Title in phone landscape: the menu runs off the bottom

At 844×390 with a save present, the four items (Fortsetzen + note, Neues Spiel, Kapitel, Einstellungen) do not fit, and „Einstellungen“ is cut off at the bottom edge (l07-title.png). The logo uses about 45% of the height. Fix: add an `@media (max-height: 460px)` rule (or test ctx.hud.h): shrink .title-name to about 2.6em, hide the kicker or the flourish, and either put the menu in a column to the right of the logo or reduce the item spacing. Check 844×390 and 667×375.

## 7. [major] Dev warps take over „Fortsetzen“ and silently overwrite the player's save

Opening ?scene=ui-demo, using F2, or picking a scene in Kapitel all go through G.warp → G.goto → state.save. Afterwards the title offers „Fortsetzen · Dev · UI-Vorführung“ (l07-title.png, st01-title.png), and a real campaign save would already have been overwritten. Picking a scene in the title's Kapitel list also overwrites a save without asking. Fixes in title.ts: savedScene() should ignore saves whose chapter is hidden unless devMode() is on. Picking a scene in the chapter list while a non-hidden save exists should ask once (the same pattern as „Neues Spiel – sicher?“). Request for core: G.goto should not autosave for hidden chapters.

## 8. [major] Dev chapter's sample entries leak into the real journal

chapters/dev-ui/index.ts calls registerItems/Memories/Lore/Clues/Abilities when the file is loaded, and the chapters are imported eagerly in every build. The journal's Erinnerungen tab lists every registered memory the player has not found as „Verblasste Erinnerung“ and counts it in „x / N“ (journal.ts). Real players will see 3 extra placeholders and a wrong total. Fix: move the demo registrations into startDemo() (it runs before the demo) or into a prepare() hook. In the journal, also count locked memories only for non-hidden chapters, or for an explicit list, so other dev chapters cannot cause the same leak.

## 9. [major] Plate pan crops content at the frame edge; dialogue covers the plate frame

pan:'left'/'right' scales the plate to 1.1 and shifts it ±3.5%, so roughly the outer 8–9% is cut off. On Mother's map, the „Crios / steht immer im Westen“ label shows as „RIOS“ / „mmer im Westen“ at 1280 and 1920 (b01-plate-say.png, d07). Fix: reduce the pan to scale 1.06 and translate ≤2%, and document a safe area (8% inset) in ui-guide.md and as a plateKit helper; move the Crios label inside it. Also, at 1280×720 the dialogue portrait frame (top at y≈548) overlaps the plate's bottom corners (y≈560). While a dialogue is open over a plate, fitOne should reserve the dock height (e.g. availH = stage.h·0.62 minus the overlap) or move the plate up.

## 10. [major] Portrait phone: game pixels shown at 0.81×, plate tiny, narration justified with large gaps

At 390×844 the 16:9 canvas is a 220 px strip at about 0.81× scale, so pixel art is resampled unevenly. Mother's map plate becomes an unreadable thumbnail between two large empty bands (p02). Book narration uses `text-align: justify` with a drop cap and shows wide word gaps („Es   war  der  letzte  Tag  des“, p01). Fixes: (1) show a dismissable rotate hint in portrait („Am schönsten im Querformat“), styled as a .ch-panel and stored in localStorage. (2) In portrait, crop the plate into a taller viewport (e.g. 4:5, object-fit: cover) and let the pan travel across it. (3) Use `.is-portrait .narr-book .narr-text { text-align:left }` and set lang='de' on the narration element so hyphenation applies.

## 11. [major] Bag has no „Benutzen“ action, which DESIGN §4 requires

In bag.ts every grid item's activate is empty, and ItemDef has no field for using an item. Proposed additive API in UiApiExt: `registerItemAction(itemId: string, action: { label?: string /* default 'Benutzen' */; when?: () => boolean; run: () => void | Promise<void>; closeBag?: boolean })`. Show it as a .ch-btn in the bag's detail pane and trigger it with Enter/E/tap on the selected slot. If no action exists, play ui-cancel and show a short line from Lia (or „Das kann ich hier nicht gebrauchen.“). Chapter authors need this for the tincture, the tinder and the dagger.

## 12. [major] Touch: the stick zone swallows tap-to-walk, and the hint cannot be tapped

In landscape, .touch-zone covers left:0, top:28%, width:50%, so a tap anywhere there never reaches the canvas. DESIGN §4 requires that tapping the world sets a walk target. Fix in touch.ts: start the stick only after the pointer has moved more than 10–12 px. Pass short taps (<220 ms, <12 px) through to the canvas with a synthetic pointerdown/up at the same client coordinates, or ask core for a `virtualInput.tap: {x,y}|null` field. Separately, on touch the large hand hint is decoration only. Make `.is-touch .hint-box` pointer-events:auto and have a tap set virtualInput.actionPressed = true with the press animation, so players can tap what they see.

## 13. [minor] Chapter list layout bug: the badge wraps under the numeral; turquoise used for „Dev“

In .chap-head (grid 3.4em 1fr auto), .chap-sub takes columns 2–4 and is added before .chap-badge. When a chapter has a subtitle, the badge drops to a new row under the numeral (ti04-kapitel-dev.png). Fix: `.chap-badge { grid-column: 3; grid-row: 1 }` (or add the badge before the subtitle). The numeral already says „Dev“, so the badge repeats it. It is also turquoise, which DESIGN reserves for magic and active goals; use gold-faint or grey.

## 14. [minor] Struggle hold has no heartbeat and no trembling bar

DESIGN §7 (Überfall) asks for a trembling bar plus a heartbeat. hold.ts only shakes the ring and label and plays no heartbeat. Fix: in struggle mode start `G.audio.loop('heartbeat', { interval })` and shorten the interval as progress rises (stop it on finish or reset). Apply the tremble to .hold-bar too. On touch, call navigator.vibrate?.(40) when the player lets go. Also drop either the ring or the bar in struggle mode; they show the same value twice.

## 15. [minor] Objective pointer shows a turned arrow on top of an on-screen target

When the target lies inside the inset rectangle, placePointer() draws the arrow at the target itself, turned by its angle from the screen centre. DESIGN wants a subtle edge arrow only when the goal is off-screen. Fix: hide the pointer when the target is inside (fade it out), or switch to a small bobbing marker above the target without rotation.

## 16. [minor] Polish and small bugs

(1) The key labels under the HUD buttons (J / I / Esc) are about 8 px and unreadable: raise them to 0.62em or show them only on hover. (2) The ASCII „~ … ~“ around think() text looks cheap: use a small gold flourish or a ❧ glyph. (3) Coming back from Einstellungen or Kapitel resets the pause-menu selection to „Fortsetzen“: keep the last index. (4) The F2 filter hides rows, but NavList still moves onto hidden rows, and chapter headers with no matching scenes stay visible: rebuild the NavList from the visible rows. (5) BubbleUi.follow() reads offsetWidth for every bubble on every frame right after writing transforms, which forces a layout each time: cache the width when the bubble is created or the layout changes. (6) buildSettings adds a fullscreenchange listener every time it opens and never removes it. (7) choose() changes the caller's option objects when all options are disabled (`o.disabled = false`): copy the list first. (8) choose({speaker}) without a prompt ignores speaker: document this or use it to show the name band. (9) The journal's Ziele detail repeats the objective under the heading „Notiz“ and adds nothing; show chapter or scene and when it was set or finished instead. (10) DESIGN §4 also lists a „Figuren“ tab in the journal; it is missing (the brief did not ask for it, so this is a later wish).

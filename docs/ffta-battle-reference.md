# FFTA battle reference

The supplied Markdown contains two video IDs. Both were downloaded with yt-dlp into `output/references/ffta/` on 2026-10-05. Video files remain local and are excluded from Git.

- [Final Fantasy Tactics Advance 5 Tips Everyone Should Use!](https://www.youtube.com/watch?v=mPO4sPouzew), 4:20.
- [Things You Should Know Before Playing Final Fantasy Tactics Advance](https://www.youtube.com/watch?v=xO3rRcEa-FI), 4:35.

The default downloader client returned HTTP 403. The installed yt-dlp succeeded with `--extractor-args 'youtube:player_client=android,web_safari'` and a maximum video height of 480 pixels. FFmpeg extracted these frames without cropping or editing them:

- `output/references/ffta/attack-preview-112.5s.png`: paired attacker/defender panels, HP, MP, level, EXP, 22 damage and 85% hit chance.
- `output/references/ffta/hover-stats-105s.png`: the compact character inspection card.
- `output/references/ffta/equipment-stats-25s.png`: character equipment and stat screen, including speed.
- Contact sheets for both complete videos, plus a one-second contact sheet around the attack preview.

## Selantis behavior

Character cards show HP, MP, Lvl, Exp and Tempo (speed). Hovering over another unit opens its inspection card.

When a player unit's turn starts it is already selected and its menu is open: Bewegen (M), Aktion and Warten (F), plus Rückgängig while a move can still be undone. Bewegen and Aktion are each available once per turn, in any order. Bewegen shows every reachable tile; the range comes from the Move stat, and each height level up or down costs one extra move point. Aktion lists the unit's basic attack first ("Angriff", hotkey 0), then its specials (digits 1–9 by position in the unit's ability list). The basic attack comes from the unit definition, else the equipped weapon, else an unarmed strike; escorts can opt out. Warten skips the rest of the turn. Escape and empty-tile clicks step back to the menu but never deselect the active unit.

After choosing an action the player sees its range. Hovering a unit (single target) or a ground tile (line, cone, area) highlights every affected tile and previews the forecast; a click pins it. The forecast follows FFTA: the attacker beside one focused affected unit, with portraits, HP now → after, damage per strike, hit chance, direction (Vorne/Seite/Rücken) and the modifiers. A pager ("‹ 1/3 ›", Tab/Shift+Tab, or taps) cycles the focus through all affected units, a marker shows the focused unit on the field, and the camera pans to it when it is off-screen. A second click on the same target, the confirmation button or Enter executes the action for every affected unit. Selecting another target replaces the preview without spending MP or the action. Damage in this panel is conditional on a hit; each strike rolls separately.

Physical attacks use FFTA's facing rule: 50 % from the front, 70 % from the side, 90 % from behind, then ±3 % per point of speed difference (capped at ±15 %), ±5 % per height level (capped at three levels), the ability's hit modifier, bush cover (−30), evasion (−45) and stun (+25), clamped to 5–100 %. Magic and `noFlank` abilities keep their own accuracy. Damage is power + attack − defense (at least 1), halved by Schutzwall; facing and height no longer multiply it.

All teams share a speed-sorted round. Each eligible unit receives one move and one action; equal speeds use the unit ID for a stable tie break. The queue is fixed for that round. A level-up speed increase applies next round. Defeated and bound units are skipped. Reinforcements and freed prisoners join the following round. Warten or Zug beenden opens a direction choice. The selected facing is previewed on the figure and committed when the player confirms the turn. Completing movement and an action also opens this choice instead of advancing automatically. AI units turn toward the nearest threats before they wait. Cooldowns, statuses and 2 MP recovery tick on the owner's turn. Existing story onRound hooks run once per team per round.

A successful action gives 10 EXP and 10 AP, or 20 EXP for an action that defeats a unit. Multi-hit and multi-target actions receive one award. Misses and waiting receive none. Winning gives surviving party members another 20 EXP and 20 AP. Every 100 EXP increases level, retaining the remainder, up to level 50. Level growth adds 3 maximum HP, 2 maximum MP and 1 attack; defense rises every two levels and speed every five. Increasing maxima preserves missing HP/MP and does not revive a downed unit.

Campaign starting levels and level-one attributes now live in `chapters/common/battleCharacters.ts`. Valentus starts at level 20, Falke at 12, Flick at 8, Lia at 2 and Kyra at 1. Young Baris is level 9; the later captain is level 16. `baseStats` and the level derive HP/MP maxima, attack, defense and speed through the same curve used by earned level-ups. Story battles and demos share these profiles, and old placeholder levels cannot lower the authored starting level.

Weapons grant skills while equipped. After 50 AP, those skills remain usable with another weapon. The character card shows the equipped weapon, AP and mastery, and lets the active unit switch among owned weapons before moving or acting. Story interactions and unarmed support skills remain available. Starting weapons come from each encounter's authored equipment and skills; this does not add a weapon shop or loot system.

Magic has MP costs: Strahl 6, Druckwelle 8, Schutzwall 4. An unaffordable action stays disabled and cannot spend MP or the action. Equipment, level, EXP and mastery are committed to campaign state on victory, included in the next checkpoint save, and restored in later battles. Retrying a defeat starts from the last committed progress. Existing version-one saves load with an empty character progression record.

The engine retains its phase mode for legacy callers and isolated rule tests. All playable tactics scenes use speed turns through BattleController.

## Validation

TypeScript and the production build pass. Unit tests cover speed order, skipped turns, MP validation, equipment mastery, growth, save migration, victory rewards and retry rollback. Browser tests cover the paired forecast, the target pager and action execution at desktop, phone landscape and phone portrait sizes, the default selection and Escape steps, plus resizing during a turn. The prologue battle and following cutscene, the rescue through the finale, and the battle keyboard controls were exercised with their browser tests.

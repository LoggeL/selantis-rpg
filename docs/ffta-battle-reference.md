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

Character cards show HP, MP, Lvl, Exp and Tempo (speed). Hovering over another unit opens its inspection card. A valid ability target opens a paired forecast with the acting unit's MP cost, target HP after a hit, hit percentage, damage per strike and terrain/facing modifiers. Multi-target actions list the other affected units. Damage in this panel is conditional on a hit; each strike rolls separately.

All teams share a speed-sorted round. Each eligible unit receives one move and one action; equal speeds use the unit ID for a stable tie break. The queue is fixed for that round. A level-up speed increase applies next round. Defeated and bound units are skipped. Reinforcements and freed prisoners join the following round. Warten or Zug beenden advances to the next character. Cooldowns, statuses and 2 MP recovery tick on the owner's turn. Existing story onRound hooks run once per team per round.

A successful action gives 10 EXP and 10 AP, or 20 EXP for an action that defeats a unit. Multi-hit and multi-target actions receive one award. Misses and waiting receive none. Winning gives surviving party members another 20 EXP and 20 AP. Every 100 EXP increases level, retaining the remainder, up to level 50. Level growth adds 3 maximum HP, 2 maximum MP and 1 attack; defense rises every two levels and speed every five. Increasing maxima preserves missing HP/MP and does not revive a downed unit.

Weapons grant skills while equipped. After 50 AP, those skills remain usable with another weapon. The character card shows the equipped weapon, AP and mastery, and lets the active unit switch among owned weapons before moving or acting. Story interactions and unarmed support skills remain available. Starting weapons come from each encounter's authored equipment and skills; this does not add a weapon shop or loot system.

Magic has MP costs: Strahl 6, Druckwelle 8, Schutzwall 4. An unaffordable action stays disabled and cannot spend MP or the action. Equipment, level, EXP and mastery are committed to campaign state on victory, included in the next checkpoint save, and restored in later battles. Retrying a defeat starts from the last committed progress. Existing version-one saves load with an empty character progression record.

The engine retains its phase mode for legacy callers and isolated rule tests. All playable tactics scenes use speed turns through BattleController.

## Validation

TypeScript and the production build pass. All 228 unit tests pass, including speed order, skipped turns, MP validation, equipment mastery, growth, save migration, victory rewards and retry rollback. Browser tests cover the paired forecast and action execution at desktop, phone landscape and phone portrait sizes, plus resizing during a turn. The prologue battle and following cutscene, the rescue through the finale, and the battle keyboard controls were exercised with their browser tests.

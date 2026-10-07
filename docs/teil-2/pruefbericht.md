# Prüfbericht Teil II „Letzte Hoffnung“ – Endabnahme

Stand: 2026-10-07, Arbeitsbaum auf `main` (HEAD `ef67f16`) plus uncommittete Teil-II-Änderungen.
Alle Läufe nacheinander, Playwright immer mit `--workers=1`, Port 5198, ohne zusätzliche Dev-Server.
Nach dem Lauf waren keine Vite-, Playwright- oder Browser-Prozesse mehr aktiv. Außer diesem Bericht wurde keine Datei geändert.

## 1. Befehle

```sh
cd game
npx tsc --noEmit
npx vitest run
npm run build
cd ..
node scripts/map_tool.mjs all
python3 scripts/art/build_manifest.py --check
cd game
# je Datei ein eigener Aufruf, streng nacheinander:
SELANTIS_E2E_PORT=5198 SELANTIS_E2E_OUTPUT=test-results/final[/<suite>] \
  npx playwright test e2e/<suite>.pw.ts --workers=1 --reporter=line
cd ..
node scripts/story_voice_inventory.mjs --check
```

Ab der zweiten Suite schreibt jeder Lauf in einen eigenen Unterordner (`test-results/final/<suite>`). Playwright leert das Ausgabeverzeichnis vor jedem Lauf, und so bleiben die Traces früherer Fehlschläge erhalten.

## 2. Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| `tsc --noEmit` | ✓ Exit 0, keine Fehler |
| `vitest run` | ✓ 47 Dateien, 314 Tests bestanden (darunter `teil-2/aufbruch`, `urmacht-wissen`, `flick-entkommt`, `taverne-route`) |
| `npm run build` | ✓ Exit 0. Zwei Warnungen: Chunk > 500 kB und „BootScene dynamisch und statisch importiert“. Beide Muster gab es schon vorher, `bookContract.ts` nutzt nur denselben Import wie Kapitel 1–5. |
| `map_tool.mjs all` | ✗ Exit 1, aber nur wegen der Baseline `k1-hof-trauer` (siehe 3.1). Alle 25 `e2-*`-Karten ✓ |
| `build_manifest.py --check` | ✓ Manifest aktuell (69 Figuren, 57 Porträts, 30 Hintergründe, 39 Tafeln, 82 Props, 16 Bilder, 27 Icons) |
| `story_voice_inventory.mjs --check` | ✗ Exit 1, erwartete Baseline zu `kapitel-1/wiese.ts:171` (siehe 3.3) |

### Playwright (je Datei ein Lauf, `--workers=1`)

| Suite | Ergebnis | Dauer |
|---|---|---|
| `e2e/teil-2.pw.ts` | ✓ 31/31 | 25,0 min |
| `e2e/teil-2-uebergang.pw.ts` | ✓ 4/4 | 16 s |
| `e2e/smoke.pw.ts` | ✓ 21/21 | 46 s |
| `e2e/travel-encounters.pw.ts` | ✓ 5/5 | 2,6 min |
| `e2e/urmacht.pw.ts` | ✓ 3/3 | 49 s |
| `e2e/input.pw.ts` | ✓ 4/4 | 21 s |
| `e2e/scene-actions.pw.ts` | ✓ 15/15 | 1,9 min |
| `e2e/kapitel-5.pw.ts` (fremd geändert, nur ausgeführt) | ✓ 10/10 | 7,6 min |
| `e2e/kapitel-4.pw.ts` | ✗ 3/4, 1 Baseline-Fehler (siehe 3.2) | 5,9 min |
| `e2e/kapitel-3.pw.ts` | ✓ 3/3 | 4,7 min |

Der Komplettdurchlauf in `teil-2.pw.ts` meldet:
`{"teleports":[],"workarounds":[],"mouseIssues":[],"battles":["e2-ueberfall:win","e2-uebungskampf:win"],"defeats":0,"lookPresses":7,"clicks":470}`.
Er spielt also vom gewachsenen Buch-1-Spielstand bis zum Ende von Teil II nur mit echten Eingaben, ohne Teleports und ohne Workarounds.

Abgedeckt sind außerdem: Direkteinstieg in alle 18 Szenen, Lichtstoß (wird einmal gelernt bzw. ist schon bekannt), Reload mit genau einem Schattentöter, Übungskampf-EXP nur einmal, Reloads im Lagerangriff, alter Spielstand mit `k5-ende` in der Kapitelwahl, F2-Debug-Warp, Handy hoch und quer (Touch) sowie Ton an/aus.

## 3. Baseline-Fehler (bestehen schon vorher, nicht durch Teil II verursacht)

### 3.1 `map_tool`: `k1-hof-trauer` – NPC `schwein-1..3` unerreichbar
- Die Schweine stehen in `game/src/chapters/kapitel-1/trauer.ts:50–52` (`solid: false`, dekorativ im Gehege).
- `git status` und `git diff HEAD` zeigen für `game/src/chapters/kapitel-1/`, `game/src/world/` und `scripts/map_tool.mjs` **keine** Änderungen. Der Befund steckt also schon im committeten Stand (zuletzt `ef67f16`, `9c99648`, `99c9e64`).
- Teil II greift nicht auf diese Karte zu. Keine Regression.

### 3.2 `kapitel-4.pw.ts` › „verrat: sneak to Elnon’s tent, overhear Foltan, flee into the night“
- Fehler: `advanceUntil: condition not reached` (`e2e/kapitel-4.pw.ts:268`). Laut Seiten-Snapshot steht der Test vor der Auswahl „1 Reingehen und es ihm ins Gesicht sagen / 2 Gehen, bevor sie mich hören“.
- Ursache: Diese Auswahl (`game/src/chapters/kapitel-4/verrat.ts:190`) kam erst mit dem **committeten** HEAD-Commit `ef67f16` („rewrite film-copied dialogue“) hinzu. Belegt durch `git log -S"Gehen, bevor sie mich hören"`, das nur `ef67f16` findet. `k4-gehoert` wird erst nach der Auswahl gesetzt. Der `advanceUntil`-Helfer im Test drückt nur Enter und beantwortet keine Auswahl. Deshalb wird die Bedingung nie erreicht.
- `verrat.ts`, `e2e/kapitel-4.pw.ts`, `e2e/sceneActions.ts` und die Auswahl-UI sind gegenüber HEAD unverändert. Die einzige Änderung unter `game/src/ui/` ist `interactions.ts`, und die ist rein additiv (optionale `help`, `illustration`, `keyHint` mit unverändertem Standard).
- Keine Regression durch Teil II. Zu beheben ist es in `kapitel-4.pw.ts`: `advanceUntil` muss sichtbare Auswahlen beantworten, etwa mit Taste `2` wie später in derselben Datei. Das gehört nicht zum Auftrag dieser Abnahme.

### 3.3 `story_voice_inventory.mjs --check` – „Review AST hash absent: game/src/chapters/kapitel-1/wiese.ts:171“
- Die Regie-Datei `docs/voice-production/directions/kapitel-1.json` stammt aus `4a9f443` (2026-10-05) und ist unverändert.
- `wiese.ts` wurde danach im committeten `ef67f16` (2026-10-07) umgeschrieben. Der gespeicherte AST-Hash passt deshalb nicht mehr.
- `wiese.ts` ist gegenüber HEAD unverändert. Ohne Bezug zu Teil II, wie erwartet.

## 4. Regressionen

**Keine gefunden.** Alle Suites, die von den Teil-II-Änderungen berührt werden, laufen grün. Das sind: `teil-2/**`, `common/bookContract.ts`, die Lichtstoß-Beschreibung in `common/index.ts`, `kapitel-5/finale.ts|weiterreise.ts|credits.ts`, die neuen Optionen in `ui/interactions.ts` und die Assets. Die Suites dazu: `teil-2`, `teil-2-uebergang`, `kapitel-5` (Finale weiter bis zu Credits und Titel, Option 0 unverändert „Das erste Buch abschließen.“), `travel-encounters` (Weiterreise), `scene-actions`, `smoke`, `urmacht`, `input`, `kapitel-3`.

## 5. Screenshots (neu erzeugt vom Lauf um 21:24–21:46)

Ordner: `output/qa/teil-2/screens/` (31 Dateien, `01-…27`, `30`, `40–42`). Gesichtet:

| Datei | Urteil |
|---|---|
| `output/qa/teil-2/screens/01-taverne-gaeste.png` | Taverne warm ausgeleuchtet, Gäste verteilt, Ziel „(0/3)“ lesbar. ✓ |
| `output/qa/teil-2/screens/07-lagerangriff-kampf.png` | Taktik-Karte bei Nacht, Gruppe und Gegner klar getrennt, Fluchtfeld (Fahne) am Bach sichtbar. Aufnahme während des Titelbanners „Überfall im Morgengrauen“. ✓ |
| `output/qa/teil-2/screens/11-halle-gefangene.png` | Halle mit Thron und Kohlebecken, Lia an der Kette, Prompt „An der Kette ziehen“, Ziel „(0/4)“. ✓ |
| `output/qa/teil-2/screens/14-konzentration-minispiel.png` | Minispiel „Sammlung“ sauber, Bedienhinweise für Tastatur, Maus und Touch vollständig. ✓ (Das Wort „Kyra“ als Störung liegt am Ringrand. Gewollt, aber eng.) |
| `output/qa/teil-2/screens/16-ignatius-schattentoeter.png` | Tafel „Schattentöter“, Ignatius übergibt den Stab, Porträt und Text passen, Ziel-Toast oben rechts. ✓ |
| `output/qa/teil-2/screens/18-kerker-zellen.png` | Kerker mit drei Zellen, Wärter am Tisch, Prompt „An die Wand klopfen“. ✓ Die Figuren hinter den Gittern sind sehr klein und dunkel. Gut lesbar ist das nur durch den Prompt. |
| `output/qa/teil-2/screens/20-uebungskampf.png` | Isometrische Waldkarte „Am Bach des Einsiedlers“, Lia und Ignatius gegen Schatten. Aufnahme während des Banners, die mittlere Einheit wird teilweise verdeckt. ✓ |
| `output/qa/teil-2/screens/26-aufbruch-tafel.png` | Schlusstafel „Letzte Hoffnung“: Lia mit Stab am Herbsthang, Erzähltext stimmig. ✓ |
| `output/qa/teil-2/screens/30-kapitelwahl-teil-2.png` | Kapitelwahl mit eigener Kopfzeile „Teil II · Letzte Hoffnung – Zurück zu den Rebellen“ unter den Buch-1-Kapiteln. ✓ |
| `output/qa/teil-2/screens/41-phone-quer-taverne.png` | 844×390 quer: Touch-Knöpfe (Schleichen, Rennen, Interagieren) überdecken nichts Wichtiges, Ziel lesbar. ✓ |

Weitere Dateien im Ordner (nicht einzeln kommentiert): `02-waldposten`, `03-lager-tag`, `04-pruefung-tafel`, `05-sehkugel`, `06-lager-nacht`, `08-bach-flucht`, `09-trennung-tafel`, `10-ignatius-lager`, `12-bericht-tafel`, `13-verhoer`, `15-erinnerung-tafel`, `17-nachtweg`, `19-stab-training`, `21-kerker-flucht`, `22-kontrolle-tafel`, `23-flick-farn`, `24-aufbruch-morgen`, `25-aufbruch-hang`, `27-credits`, `40-phone-hochformat`, `42-phone-quer-konzentration`.

## 6. Verbleibende echte Grenzen

1. Es gibt drei Baseline-Fehler außerhalb von Teil II (3.1–3.3). Alle stammen aus committetem Code, hauptsächlich aus `ef67f16`. Sie brauchen eigene Korrekturen: `kapitel-4.pw.ts` muss die neue Auswahl beantworten, die Regie-Hashes für Kapitel 1 müssen neu erzeugt werden, und die Erreichbarkeit der Schweine in `k1-hof-trauer` muss geklärt oder im Map-Tool ausgenommen werden.
2. `teil-2.pw.ts` braucht mit einem Worker etwa 25 Minuten. Der Komplettdurchlauf ist der Engpass.
3. In den Kampf-Screenshots (`07`, `20`) liegt das Titelbanner über dem Feld. Für eine Sichtprüfung des Kampffelds wäre eine Aufnahme nach dem Banner aussagekräftiger.
4. Im Kerker (`18`) sind die Mitgefangenen hinter den Gittern klein und dunkel. Das ist ein Lesbarkeitshinweis, kein Fehler.
5. Das Haupt-Bundle ist 2,59 MB groß (gzip 810 kB) und löst die Chunk-Warnung aus. Teil II verschärft das leicht, Code-Splitting fehlt weiterhin.
6. In `tactics/**` und den zugehörigen Tests liegen fremde, uncommittete Änderungen. Die Abnahme lief mit diesem Arbeitsbaum. Ändert sich daran noch etwas, sollten `teil-2.pw.ts` (Kämpfe) und `kapitel-5.pw.ts` erneut laufen.

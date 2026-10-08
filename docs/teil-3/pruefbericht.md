# Prüfbericht Teil III „Falscher Glaube“ – Endabnahme

Stand: 2026-10-08, Worktree `SelantisRPG-teil3`, Branch `feat/teil-3` auf `9bd6748` plus uncommittete
Teil-III-Änderungen. Inzwischen liegt `origin/main` zwei Commits weiter (`cbba6af`, `0c42eaf`). Diese Commits wurden
nicht mitgeprüft, siehe 6.1.
Alle Läufe nacheinander, Playwright immer mit `--workers=1` und Port 5225, ohne zusätzlichen Dev-Server. Nach dem Lauf
waren keine Vite-, Playwright- oder Browserprozesse dieses Worktrees mehr aktiv.

Geändert habe ich in dieser Stufe nur die Dokumentation: diesen Bericht und vier veraltete Stellen in
[adaption.md](adaption.md). Das waren ein Platzhaltersatz, die Blutstärke in `e3-falle` (0,4 statt 0,6, jetzt
`common/blood.ts`), der Verweis auf `common/blood.ts` in `e3-vamir` und der Hinweis, dass `game/e2e/scratch-teil3-port/`
nur lokal liegt. Code und Tests blieben unverändert, weil kein Lauf fehlschlug.

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
# je Datei ein eigener Aufruf, streng nacheinander, jede Suite mit eigenem Ausgabeordner:
SELANTIS_E2E_PORT=5225 SELANTIS_E2E_OUTPUT=test-results/final3/<suite> \
  npx playwright test e2e/<suite>.pw.ts --workers=1 --reporter=line
```

## 2. Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| `tsc --noEmit` | ✓ Exit 0, keine Fehler |
| `vitest run` | ✓ 83 Dateien, 591 Tests bestanden. Davon gehören 21 Dateien mit 168 Tests zu `teil-3/` (u. a. `ritualangriff-battle` 19, `epilog` 12, `vamir-duell-battle` 9). |
| `npm run build` | ✓ Exit 0, gebaut in 4,4 s. Zwei Warnungen, beide schon bekannt: Chunk > 500 kB (Haupt-Bundle 3,41 MB, gzip 1,10 MB) und „BootScene dynamisch und statisch importiert“. `teil-3/epilog.ts` nutzt denselben dynamischen Import wie Teil II und Kapitel 1–5. |
| `map_tool.mjs all` | ✗ Exit 1, nur wegen der Baseline `k1-hof-trauer` (siehe 3.1). Alle 31 `e3-*`-Karten ✓, insgesamt 88 ✓ und 1 ✗ |
| `build_manifest.py --check` | ✓ Manifest aktuell (76 Figuren, 60 Porträts, 42 Hintergründe, 73 Tafeln, 83 Props, 79 Bilder, 29 Icons) |

### Playwright (je Datei ein Lauf, `--workers=1`, Port 5225)

| Suite | Ergebnis | Dauer | Zeit |
|---|---|---|---|
| `e2e/teil-3.pw.ts` | ✓ 28/28 | 31,5 min | 20:43–21:15 |
| `e2e/teil-3-uebergang.pw.ts` | ✓ 2/2 | 51 s | 21:15–21:16 |
| `e2e/smoke.pw.ts` | ✓ 59/59 (darin 19 Teil-III-Szenen am Desktop und 19 `@phone`) | 2,6 min | 21:16–21:18 |
| `e2e/teil-2-uebergang.pw.ts` | ✓ 4/4 | 17 s | 21:18–21:19 |
| `e2e/input.pw.ts` | ✓ 4/4 | 23 s | 21:19 |
| `e2e/scene-actions.pw.ts` | ✓ 15/15 | 1,9 min | 21:19–21:21 |
| `e2e/urmacht.pw.ts` | ✓ 3/3 | 51 s | 21:21–21:22 |
| `e2e/tactics-input.pw.ts` | ✓ 10/10 | 51 s | 21:22–21:23 |

Ausgaben: `game/test-results/final3/<suite>/` (leer, weil nichts fehlschlug), Logs nur in der Sitzung.

### Komplettdurchlauf (`teil-3.pw.ts` › „full playthrough from e3-valentus to the title with real inputs“)

Der Lauf startet bei `e3-valentus` mit einem gewachsenen Spielstand (siehe 6.2) und spielt alle 19 Szenen bis zum Titel
durch. Er nutzt nur Tasten, Canvas-Klicks und Klicks im Kampfmenü. Laufzeit etwa 18 Minuten.

```
DRIVE {"teleports":[],"workarounds":[],"mouseIssues":[],"battles":["e3-ritualangriff:win","e3-vamir-duell:win"],
 "defeats":0,"lookPresses":14,"clicks":610,
 "drive3":{"aims":["stamm → kapsel-links","kapsel-links → kapsel-mitte","kapsel-mitte → kapsel-rechts"],"spiritClicks":11,
  "lookClues":["spur-stumpf","spur-fels","spur-felsblock","spur-wagen"],
  "explore":["e3-ms-umsehen: interact bett","e3-vs-holz: none nothing enabled","e3-zf-erinnern: interact erinnerung-buch",
   "e3-zf-erinnern: interact erinnerung-mutter","e3-zf-erinnern: interact erinnerung-holz","e3-zf-erinnern: interact eiche",
   "e3-fh-spur: clue spur-wagen","e3-hw-gestalt: interact gestalt","e3-hw-riss: stand riss-0","e3-hw-riss: stand riss-1",
   "e3-hw-riss: stand riss-2","e3-ri-posten: spot fackel","e3-ri-posten: interact posten-fackel","e3-ri-posten: spot kreis",
   "e3-ri-posten: interact posten-kreis","e3-ri-posten: spot hang","e3-ri-posten: interact posten-hang","e3-ri-weg: interact anstieg-offen"]},
 "battles3":[{"id":"e3-ritualangriff","outcome":"win","rounds":6,"turns":9,"defeats":[]},
             {"id":"e3-vamir-duell","outcome":"win","rounds":5,"turns":5,"defeats":[]}],"shots":40}
TINCTURE {"before":2,"after":2,"line":"Ich reibe ein paar Tropfen auf die Schläfen. … Das hier ist kein Kratzer. Das sitzt tiefer.","walkBefore":67,"walkAfter":67}
BATTLE-STAFF ["without staff: Stabstrahl no","with staff: Stabstrahl yes"]
```

Es gab keine Teleports, keine Workarounds, keine Mausprobleme, kein `G.warp` (`__warps = 0`) und keine Niederlage.
Die `scene:goto`-Folge entspricht genau `E3_SCENES[1..]`. Ritualkampf: Flick befreit Lia in Runde 4, danach arbeiten
Lichtstoß und Stabstrahl; Sieg in Runde 6. Duell: Stabstrahl und Stabimpuls im Wechsel, Sieg in Runde 5.

**Gangart (GAIT-Protokoll):** Bis `e3-kyras-fluchtweg` und am Abend in `e3-vertraute-schwester` geht Lia mit
Engine-Tempo (112, Anteil 1,0). Ab dem Tee ist sie vergiftet: Tempo 67, also 0,598 × 64k, und Rennen höchstens 1,25 ×
Gehen. Das gilt auf `e3-waldrast`, `e3-falsches-lager`, `e3-ritualhuegel-danach`, `e3-waldpfad-spur`,
`e3-waldpfad-abschied` und `e3-trapas-zeremonie`. Im Epilog (`e3-feldweg-epilog`) läuft sie wieder mit 112.

## 3. Abdeckung

| Bereich | Nachweis |
|---|---|
| Direkteinstieg `?scene=` | 19/19 Szenen: Ziel oder Dialog sichtbar, `e3-eingang = 'direkt'`, `e2-finished`. Eigener Stab und Schattentöter entsprechen dem dokumentierten Stand in `prepareE3`. Keine Konsolenfehler. Screenshots `direkt-*`. |
| Kapitelwahl | Alle 19 Zeilen im dritten Buch („Falscher Glaube“) starten ihre Szene. Titel entsprechen der Registry, gespeichert wird an der gewählten Szene. Screenshot `kapitelwahl-teil-3`. |
| Stabzustände | Nach jeder Szene geprüft (`AFTER_SCENE`): Erhalt (+1 `e3-lia-staff`, Stabstrahl genau einmal), Rückgabe des Schattentöters (0), Beschlagnahme (`waffenkammer`, 0), Zurücklassen (`e3-stab-zurueckgelassen`), Flick trägt ihn (`flick`, 0), Rückgabe im Ritualkampf (`lia`, 1). Im ganzen Lauf nie mehr als ein eigener Stab, ein Schattentöter und eine Fibel. Im Kampf gilt: ohne Stab kein Stabstrahl, mit Stab Stabstrahl. |
| Gift | Gilt von `e3-vertraute-schwester` bis vor `e3-hueterin` am Start jeder Szene, danach `e3-gift-abklingend`. Die Gangart ist gedrosselt (siehe oben). Die Tinktur wurde vergiftet mit echter Eingabe aus der Tasche benutzt: Lias Satz erscheint, nichts wird verbraucht und das Tempo bleibt gleich. 60 % LP/MP im Kampf prüfen die Modultests (`ritualangriff-battle`, `vamir-duell-battle`). |
| Reload | `e3-eigener-stab`: Reloads nach dem Stab und in der Wiederbegegnung, danach weiter genau ein Stab und ein Stabstrahl. `e3-ritualangriff`: Reload mitten im Kampf und nach dem Sieg, EXP nur einmal, ein Stab. `e3-hueterin`: Reloads um die Zeremonie und im Epilog, die Fibel genau einmal. |
| Einmalige Belohnungen | Fibel (`e3-fibel-erhalten`), EXP aus Ritualkampf und Duell (`e3-ritual-gewonnen`, `e3-duell-gewonnen`), Stab, Schattentöter (zurückgegeben und wiedergefunden), Stabstrahl. Am Ende ist keine Fähigkeit doppelt. Lias Level und EXP sinken nicht. |
| Echter Teil-II-Übergang | `teil-3-uebergang.pw.ts`: (1) Ein gewachsener Teil-II-Spielstand spielt das Ende von `e2-aufbruch` mit echter Eingabe und kommt in `e3-valentus` an. Charaktere, Inventar, Fähigkeiten, Erinnerungen, Wissen, Hinweise und Flags bleiben unverändert, `e3-eingang = 'teil-2'`, Gruppe leer, kein Teil-II-Ziel offen, Autosave enthält den fortgesetzten Stand. (2) Ein alter, schon beendeter Teil-II-Spielstand kommt über Fortsetzen und „Weiter: das dritte Buch.“ an. `teil-2-uebergang.pw.ts` bleibt grün. |
| Handy hoch (390×844) und quer (844×390) | Nur Touch: `e3-valentus`, `e3-falscher-glaube` und `e3-epilog` über die Kapitelwahl. Dialog und Ziel sind lesbar, die Seite scrollt nicht seitlich, ein Tipp in die Welt bewegt Lia. Ritualkampf per Touch: hoch drei Züge, quer der ganze Kampf (Sieg in 7 Runden, 11 Züge, alle Panels im Bild, jede Touch-Aktion traf ihr Feld). Danach genau ein Stab. Im Hochformat erscheint der Querformat-Hinweis. |
| Reduzierte Bewegung | Auf dem Handy am Titel per Tipp eingeschaltet (`aria-pressed`, `G.settings.reducedMotion`). Sie bleibt über Titelwechsel erhalten, `#ui.reduced-motion` ist in jeder Szene gesetzt. Die Desktop-Läufe laufen mit `QUIET` (ebenfalls reduziert). |
| Ton aus | Alle Teil-III-Läufe mit Musik, Stimme und Effekten auf 0 (`QUIET`, `PHONE_SETTINGS`). Einen Lauf mit Ton an gibt es nicht (siehe 6.4). |
| Titelwechsel | Die Kapitelwahl kehrt vor jeder der 19 Zeilen zum Titel zurück. Das Handy wechselt zwischen drei Szenen über den Titel. `e3-hueterin` spielt bis zum Titel und setzt den beendeten Spielstand fort: Schlusswahl „Den Abspann noch einmal ansehen.“ / „Zurück zum Titel.“, Fibel weiter 1. |
| Smoke | Erstes Bild jeder Teil-III-Szene ohne Eingabe, am Desktop und auf dem Handy. |

## 4. Baseline-Fehler (bestanden schon vorher, nicht durch Teil III verursacht)

### 4.1 `map_tool`: `k1-hof-trauer` – NPC `schwein-1..3` unerreichbar
Das ist derselbe Befund wie im [Teil-II-Prüfbericht](../teil-2/pruefbericht.md) §3.1. Die Schweine stehen dekorativ im
Gehege (`kapitel-1/trauer.ts`). `git diff` zeigt keine Änderung unter `kapitel-1/`, `world/` oder `scripts/map_tool.mjs`.
Teil III berührt diese Karte nicht.

Weitere Fehlschläge gab es nicht. Alle acht Playwright-Suiten liefen ohne Wiederholung grün.

## 5. Regressionen

**Keine gefunden.** `git diff 9bd6748 --stat` (Basis dieses Worktrees) zeigt nur Änderungen unter
`game/src/chapters/teil-3/**`, `docs/teil-3/**`, die neuen Dateien `game/e2e/teil-3*.pw.ts` und
`game/e2e/teil3Helpers.ts` sowie 19 zusätzliche Einträge in der `SCENES`-Liste von `game/e2e/smoke.pw.ts`. Die
Teil-III-Stufen in `common/liaKit.ts` (`LIA_STAGES`, `DESPAIR_LINE`) liegen schon auf der Basis. `teil-3/blood.ts` wurde
gelöscht, Teil III nutzt jetzt `common/blood.ts` wie Teil II. Die Suiten an den Berührungspunkten sind grün:
`smoke`, `teil-2-uebergang` (Schluss von Teil II), `scene-actions` und `input` (Gesten und Eingabe), `urmacht`,
`tactics-input` (Kampf-UI).

## 6. Grenzen und offene Punkte

1. **`origin/main` ist weitergelaufen.** `cbba6af` entschärft Kyras Beiß-Gag (u. a. `teil-2/gefangene.ts`) und
   `0c42eaf` bringt den Gewitterhimmel in `teil-2/aufbruch.ts` und `ui/plate.ts`. Keiner der beiden Commits berührt
   `teil-3/**`. Teil III zitiert keine der geänderten Zeilen (geprüft per Suche nach „beiß/biss/Daumen“). Nach dem
   Rebase sollten `teil-3-uebergang.pw.ts` und `teil-2-uebergang.pw.ts` noch einmal laufen, weil beide über den
   Schluss von `e2-aufbruch` gehen.
2. **Kein ungebrochener Kampagnenlauf von Buch 1 bis Teil III.** Die Kette besteht aus drei geprüften Teilstücken:
   `teil-2.pw.ts` (Teil II vom gewachsenen Buch-1-Stand, letzte Abnahme 2026-10-07, in dieser Stufe nicht erneut
   gelaufen), `teil-3-uebergang.pw.ts` (Ende `e2-aufbruch` → `e3-valentus` mit echter Eingabe, ohne Reset) und der
   Komplettdurchlauf hier. Der Komplettdurchlauf startet aus `fixtureSave3('e3-valentus')` mit gewachsenen Werten
   (Level, Items, Erinnerung, `e2-abschied`). Er gilt als Durchlauf von Teil III, nicht als gespielte Gesamtkampagne.
3. **Handy:** Nicht der ganze Teil wurde per Touch gespielt, sondern drei Szenen bis zum ersten freien Moment plus der
   Ritualkampf (quer komplett, hoch drei Züge). Die übrigen Szenen sind auf dem Handy nur durch `smoke @phone` (erstes
   Bild) abgedeckt.
4. **Ton:** Alle Browserläufe liefen stumm. Die Sound-Aufrufe (`sfx`, Herzschlag-Loop) sind damit nur ohne Fehler
   gelaufen, nicht hörbar geprüft.
5. **Engine-Lücken, in Teil III umgangen** (siehe [adaption.md](adaption.md), „Technische Behelfe“): Teamwechsel und
   neues Aussehen nur über `respawn`. Violett und Bernstein im Kampf nur über defensiven Zugriff auf die Effekte. Das
   Statussymbol „Schutzwall“ bleibt türkis. Die Taschenaktion für die Tinktur ist global registriert, weil
   `ui/bag` kein `unregisterItemAction` hat.
6. **Assets offen** ([assets.md](assets.md), „Offen“): Das Porträt `ghoul` fehlt; die Leichenfresser sprechen mit
   der Platzhalter-Silhouette. Kyra trägt in der Welt bei der Flucht ihr helles Kleid, auf der Tafel `e3-phiole` dunkle
   Kleidung.
7. **Lesbarkeit in Screenshots** (keine Fehler):
   - `16-abschied`: Der liegende Ignatius ist auf der Böschung klein und farblich nah am Laub.
   - `11-flicks-hilfe`: Flick am Pfosten ist klein und steht direkt unter dem Interaktionshinweis.
   - `direkt-e3-vamir`: Lia steht am unteren Bildrand unter der Gedankenzeile.
   - `phone-landscape-e3-epilog`: Lia und Kyra stehen am unteren linken Rand.
   - Die Kampfaufnahmen `13`/`15` zeigen das Titelbanner über dem Feld.
8. **Bundle:** 3,41 MB (gzip 1,10 MB). Teil III vergrößert das Haupt-Bundle, Code-Splitting fehlt weiterhin.
9. **Handoff-Datei:** `docs/handoff/teil-3/` liegt in diesem Worktree nicht vor (nur im alten Checkout). Ihr Inhalt
   ist laut [umsetzung.md](umsetzung.md) dort eingearbeitet. Die Abnahmeliste unten folgt dem Handoff aus dem alten
   Checkout.
10. Der Ausgabeordner `output/qa/teil-3/screens/` enthält auch ältere Aufnahmen früherer Stufen (`01-e3-…`, `chain-…`,
    `part-…`). Neu aus diesem Lauf sind nur die in §7 genannten (Zeitstempel 20:43–21:16).

## 7. Screenshots (neu erzeugt 20:43–21:16)

Ordner `output/qa/teil-3/screens/`: 63 neue Dateien. Gesichtet:

| Datei | Urteil |
|---|---|
| `01-valentus-pfad.png` | Herbstpfad, verstreute türkise Lichtpunkte, Lia klein unten links, Ziel lesbar. ✓ |
| `02-lichtung-geister.png` | Weide, drei Lichtgeister, Valentus türkis durchscheinend, Lia mit Schattentöter, Ziel „(0/3). Nicht rennen.“ ✓ |
| `03-landstrasse.png` | Landstraße mit Meilenstein, Lia mit eigenem hellem Stab, Ignatius am linken Rand angeschnitten. ✓ |
| `04-ordenssaal.png` | Ordenssaal mit Großmeister auf dem Hochstuhl, Paladine, Lia auf dem Läufer, Gedankenzeile. ✓ |
| `05-falscher-glaube.png` | Dachzimmer bei Nacht, Lia in Reisekleidung, Ziel „Geh leise hinaus auf den Gang.“ ✓ |
| `06-keller.png` | Trotz des Namens das Fluchtzimmer: Kyra im Zimmer, Prompt „Fragen“, Ziel Umziehen. ✓ (Kyra im hellen Kleid, siehe 6.6) |
| `07-waldgegner.png` | Feuer im Wald, Leichenfresser, Flick am Pflock, Prompt „Den Strick am Stein reiben“. ✓ |
| `09-falle.png` | Falsches Lager, Kyra voraus, Lia auf dem Pfad, Ziel lesbar. ✓ |
| `10-innere-zuflucht.png` | Nebelwiese in Lavendel und Weiß, drei helle Stellen, Lia im weißen Kleid, kein Türkis und kein Violett. ✓ |
| `11-flicks-hilfe.png` | Verlassenes Lager bei Nacht, Prompt „Die Hände im Seil drehen“. ✓ (Flick klein, 6.7) |
| `12-ritual.png` | Ritualhügel in der Dämmerung, Ständer, dunkle Wachen, Flick mit Ignatius und Paladinen unten links, Lia auf dem Stein. ✓ |
| `13-ritualkampf.png` | Isometrischer Hügel, zehn Ständer um den Stein, Lia gefesselt in der Mitte, Banner „Am Stein – Das Ritual brechen“. ✓ |
| `14-nach-dem-kampf.png` | Kuppe danach: Kyra kniet, Lia mit Stab, Flick und Paladine, Ziel „Kyra kniet neben dem Stein.“ ✓ |
| `15-duell.png` | Waldkarte „Vamir – Auf dem Waldweg“, Vamir dunkel mit Kapuze (Gesicht verborgen), Lia mit Stab, Ignatius am Rand. ✓ |
| `16-abschied.png` | Böschung im Abendlicht, Lia, Ziel „Ignatius liegt auf der Böschung.“ ✓ (Lesbarkeit 6.7) |
| `17-hueterin.png` | Trapas bei Tag, Banner mit weißem Vogel, Lia mit Kyra und Flick, Ziel Heilerin. ✓ |
| `18-epilog.png` | Feldweg am Morgen, Lia und Kyra unten links, Ziel „Geht den Feldweg entlang nach Nordosten.“ ✓ |
| `19-credits.png` | Abspann „Falscher Glaube“, Rückblick, „Die Urmacht hat eine Hüterin gefunden“ türkis, Figurenliste ohne „Vardis“. ✓ |
| `20-tasche-tinktur.png` | Waldrast nachts, vergiftete Lia, Gedanke „kein Kratzer. Das sitzt tiefer.“ ✓ |
| `kapitelwahl-teil-3.png` | Buchansicht „Drittes Buch – Falscher Glaube“, fünf Kapitel mit Szenenzahlen, Bild der Weide. ✓ |
| `uebergang-abschlusswahl.png` | Schluss von Teil II mit Wahl „Weiter: das dritte Buch.“ ✓ |
| `phone-portrait-e3-falscher-glaube-dialog.png` | 390×844: Tafel „Weit entfernt“ (Kugel, Vamirs Hand), Text lesbar. ✓ |
| `phone-portrait-e3-valentus.png` | 390×844: Querformat-Hinweis, Spielbild mittig, Touch-Knöpfe Spurenblick, Schleichen, Rennen, Interagieren. ✓ |
| `phone-landscape-ritualkampf-zug-6.png` | 844×390: Zugleiste, Flick-Panel mit „Fesseln lösen“ und „Ständer umstoßen“, Aktionsmenü im Bild. ✓ |
| `phone-landscape-e3-epilog.png` | 844×390: Feldweg, Touch-Knöpfe überdecken nichts Wichtiges. ✓ (Figuren am Rand, 6.7) |
| `direkt-e3-hoffnung-und-weigerung.png` | Wiese ohne Nebel, Lia unter der Eiche, Gedankenzeile. ✓ |
| `direkt-e3-vamir.png` | Waldweg, Gedankenzeile. ✓ (Lia unter der Zeile, 6.7) |

Ebenfalls neu, nicht einzeln kommentiert: `08-vertraute-schwester` und die übrigen `direkt-e3-*`. Dazu
`phone-390-einstellungen`, `phone-844-einstellungen`, `phone-{portrait,landscape}-e3-{valentus,falscher-glaube,epilog}[-dialog]`,
`phone-portrait-ritualkampf[-zug-2]`, `phone-landscape-ritualkampf[-zug-2]`, `phone-landscape-nach-dem-kampf`,
`uebergang-abspann-teil-2` und `uebergang-ankunft-valentus`.

## 8. Abnahmeliste des Handoffs, Punkt für Punkt

1. **Alle tragenden Ereignisse bis etwa Filmminute 46:59 sind vertreten.** ✓ Die 19 Szenen decken F3 00:21–46:59 ab
   ([umsetzung.md](umsetzung.md) §3, Zeitmarken je Szene). Die Szenenplan-Abschnitte „Nächtliche Zeichen“ und „Die
   zehn Relikte“ sind als gerahmte Teile eingebaut ([adaption.md](adaption.md), Rahmen). Der Komplettdurchlauf
   besucht alle 19 Szenen in Reihenfolge. Vorspann, Credits und unsichere ASR-Fragmente erklären nichts über die Welt
   ([quellenpruefung.md](quellenpruefung.md) §2).
2. **Direkte Einstiege und Kapitelwahl funktionieren ohne Teil-II-Spielstand; Standardzustände dokumentiert; nach
   der Integration ein Test aus einem echten Teil-II-Stand ohne Reset.** ✓ 19 `?scene=`-Einstiege und 19
   Kapitelwahl-Zeilen. Der Zustand stammt aus `prepareBook2EndState()` plus `prepareE3` ([umsetzung.md](umsetzung.md)
   §2, Zustandsfahrplan), `e3-eingang = 'direkt'`. Den echten Übergang prüft `teil-3-uebergang.pw.ts` (§3). Einschränkung
   siehe 6.1 und 6.2.
3. **Stab erhalten, in der Stadt zurücklassen und zurückbekommen verändert den tatsächlichen Zustand; Wiederbetreten
   vervielfacht nichts.** ✓ Inventar und `e3-stab-ort` werden nach jeder Szene geprüft. Die Stabstrahl-Verfügbarkeit im
   Kampf folgt dem Inventar, das Aussehen folgt per `liaLook()` (Screens 02, 03, 05, 14). Drei Reload-Tests ohne Duplikate.
4. **Vergiftung, Trennung und Gefangenschaft schränken Lia nachvollziehbar ein. Kyras Befreiung, Vamirs Niederlage,
   Ignatius' Tod, Hüterinnenstatus und die Gruppe am Ende sind eindeutig.** ✓
   - Gift: Gangart 0,6, gedrosseltes Rennen, Taumeln, wirkungslose Tinktur, 60 % LP/MP im Kampf, kein Gegenmittel.
   - Trennung: Gruppe leer bis `e3-ignatius-abschied`.
   - Gefangenschaft: gefesselte Looks, festgehalten, Stab weg.
   - Endflags live und im Spielstand: `e3-kyra-frei`, `e3-vamir-besiegt`, `e3-ignatius-tot`, `e3-hueterin`,
     `e3-finished`, Gruppe `['kyra','flick']`.
5. **Typprüfung, Modultests, Produktionsbuild, Kartenprüfung, Manifestprüfung und Browserregressionen bestehen. Neue
   Tests prüfen echte Ziele, Entscheidungen, Gegenstände und Eingaben.** ✓ bis auf die Baseline `k1-hof-trauer`
   (4.1). Die Browsertests lesen den Zustand nur und steuern über Tasten, Klicks und Touch.
6. **Der ganze neue Teil wird auf Desktop sowie Smartphone hoch und quer durchgespielt, mit reduzierter Bewegung, Ton
   aus, Reload und Titelwechsel. Screenshots belegen neue Orte, Ritual und Epilog.** Teilweise.
   - ✓ Desktop komplett.
   - Handy hoch und quer mit reduzierter Bewegung und Ton aus: drei Szenen und der Ritualkampf, nicht der ganze Teil
     (6.3).
   - ✓ Reload und Titelwechsel (§3).
   - ✓ Screenshots von Orten, Ritual (12–14) und Epilog (18, 19).
7. **Abschlussbericht dokumentiert Quellenabweichungen, offene Fragen, Testresultate und Grenzen des Übergangs. Ein
   Testfixture wird nicht als geprüfter Kampagnendurchlauf ausgegeben.** ✓
   - Quellenabweichungen: [adaption.md](adaption.md).
   - Offene Fragen: [quellenpruefung.md](quellenpruefung.md) §2 (Baris' und des Doktors Verbleib, Relikte offen).
   - Testresultate: dieser Bericht.
   - Grenzen des Übergangs: 6.1 und 6.2. Der Komplettdurchlauf ist dort ausdrücklich als Fixture-Start benannt.

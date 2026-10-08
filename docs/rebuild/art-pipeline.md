# Art-Pipeline (Codex-Bildgenerierung → Spiel)

Verbindlich für alle Agenten, die Grafik erzeugen. Stil und Formate: `DESIGN.md` §3. Darsteller-Privatsphäre: `DESIGN.md` §2 — **nie** Film-Standbilder (`sources/frames`) oder alte Selantis-Porträts/Cutscenes als Referenz, Figuren nur nach der Figuren-Referenz in §3 beschreiben.

Alle Skripte liegen in `scripts/art/` (Python 3 + Pillow + NumPy + SciPy) und werden aus dem Repo-Wurzelverzeichnis aufgerufen. Bilder entstehen **ausschließlich** über `scripts/art/codex_image.sh` (die Skripte rufen ihn selbst auf: höchstens 3 parallel, Timeout 420 s, bis zu 2 Wiederholungen). Jeder Auftrag wird mit Prompt, Referenzen und Zielpfad in `docs/rebuild/art/<bereich>.json` protokolliert (zusätzlich `output/imagegen/log.jsonl`).

| Was | Wo |
| --- | --- |
| Rohbilder (ungetrackt) | `output/imagegen/raw/art/{characters/<id>,props,bg,cut,icons}/` |
| Figuren-Referenzbögen (getrackt) | `docs/rebuild/art/refs/<id>.png` |
| Figurenliste (Beschreibung, Größe, Posen, Stimmungen) | `scripts/art/cast.json` |
| Prompt-Bibliothek (Stil-Satz, Vorlagen, Posen, Stimmungen) | `scripts/art/prompts.py` |
| Laufzeitdateien | `game/public/assets/…` + `manifest.json` |
| QA-Vorschauen (ungetrackt) | `output/imagegen/preview/art/` |

Allgemeine Optionen aller Generatoren: `--extra="…"` (Korrekturhinweis an den Prompt), `--suffix=-v2` (Variante erzeugen, nichts überschreiben), `--force` (vorhandenes Rohbild neu erzeugen), `--gen-only` / `--build-only`, `--jobs=N` (≤ 3).

## 1. Figur hinzufügen

1. **Eintrag in `scripts/art/cast.json`** (Schlüssel = Figuren-ID, Kleinbuchstaben mit Bindestrich, Outfit-Varianten als `<id>-<variante>`, z. B. `lia-cloak`, `kyra-bound`):
   ```json
   "foltan": { "name": "Foltan", "height": 43, "desc": "Foltan, a lean former city-guard lieutenant around 40 …",
               "poses": ["sit", "kneel", "lie", "crouch", "hurt"], "moods": ["neutral", "happy", "sad", "angry", "surprised", "determined", "hurt"] }
   ```
   `desc` ist Englisch und kommt aus der Figuren-Referenz (§3), ergänzt um feste eigene Merkmale. `height` = sichtbare Sprite-Höhe in px (Erwachsene 42–44, Jugendliche 40, Baris ~52, Kinder 28–34). Bei Outfit-Varianten `"base": "<id>"` setzen — dann wird der Bogen der Grundfigur als Identitätsreferenz angehängt.
2. **Referenzbogen** (Vorne / Profil rechts / Rücken):
   `python3 scripts/art/characters.py ref foltan` → Rohbild ansehen (Read-Werkzeug). Bei Mängeln Varianten: `… ref foltan --suffix=-v2 --extra="…"`, die beste übernehmen: `python3 scripts/art/characters.py promote foltan turnaround-v2`, dann `python3 scripts/art/characters.py build foltan` (schreibt `docs/rebuild/art/refs/foltan.png`). Für neue Figuren wird `refs/lia.png` automatisch als Stil-Anker angehängt.
3. **Laufblatt**: `python3 scripts/art/characters.py walk foltan`
   Ergebnis `game/public/assets/sprites/foltan-walk.png` (256×256, 4×4 à 64×64, Zeilen Süd/West/Ost/Nord, Fußanker (32, 60)). Verarbeitung: Magenta freistellen + Entfärben der Säume → 16 Figuren erkennen → je Zeile gemeinsame Skalierung auf `height` (Ausreißer > 7 % einzeln) → Flächenmittel-Verkleinerung, leichtes Nachschärfen, weiche Kontur → **Kopfmitte** als horizontaler Anker (kein seitliches Zittern), Unterkante auf y = 60 → gemeinsame Palette mit den Posen. Als Stand-Frame (`idle`) wählt das Skript je Richtung den Laufframe mit der schmalsten Fußstellung (Sidecar `walk.json` → `idle`, im Manifest `walk.idle`; überschreibbar mit `"build": {"idleFrames": [1, 5, 9, 13]}`). Stand-Frames aus dem Referenzbogen (`"idle": "turnaround"`) sind möglich, aber standardmäßig aus, weil die Bogenfiguren schlanker sind als die Laufblatt-Figuren (Springen beim Wechsel).
   Die Ausgabe meldet je Richtung Höhen, Kopf-x, Beinbewegung und `alt13` (Unterschied Frame 1 ↔ 3). `WARN … legs do not alternate` heißt: Beine wechseln kaum → ansehen (siehe QA), ggf. neu erzeugen.
   Korrekturen ohne Neugenerierung in `cast.json` → `"build"`: `"mirror": {"left": "right"}` (West = gespiegeltes Ost), `"rowFrom": {"up": "walk-v2"}` (Zeile aus einer anderen Rohvariante), `"order": {"down": [0, 3, 2, 1]}`.
4. **Posen**: `python3 scripts/art/characters.py pose foltan` (Standard aus `cast.json`) oder `--poses=sit,lie`.
   Jede Pose wird als Paar erzeugt (links stehend als Maßstab, rechts die Pose) — so stimmt der Maßstab zum Laufblatt automatisch. Posen blicken nach **rechts** (drei Viertel); links spiegelt die Laufzeit. Ergebnis `sprites/foltan-<pose>.png` (64×64, liegend 128×64, Fußanker (32, 60) bzw. (64, 60)) + Sidecar `.json` (`facing`, `foot`). Bekannte Posen und Texte: `POSES` in `prompts.py` (sit, kneel, crouch, hurt, read, sit-read, cast, lie); neue Pose dort ergänzen, figurenspezifische Zusätze in `POSE_EXTRA`. Richtungsvarianten: Datei `sprites/<id>-<pose>-<down|up|left|right>.png`. Animierte Posen: Streifen aus N Frames + Sidecar `{"frames": N, "fps": 6}`.
5. **Porträts**: `python3 scripts/art/characters.py portrait foltan` erzeugt zuerst `neutral` (Referenzbogen + Porträt-Stilreferenz einer *anderen* Person), danach alle weiteren Stimmungen mit dem neutralen Porträt als Basis (nur der Ausdruck ändert sich). Ergebnis `portraits/foltan.png` (neutral) und `portraits/foltan-<stimmung>.png`, 256×256. Stimmungstexte: `MOODS` in `prompts.py` (neutral, happy, sad, angry, surprised, determined, hurt, pained, thinking, scared). Einzelne Stimmung nachbessern: `… portrait foltan --moods=angry --suffix=-v2 --extra="…"`, dann `promote foltan portrait-angry-v2` und `build foltan`. Porträts werden als Paletten-PNG (160 Farben) gespeichert.
6. Mehreres in **einem** Job-Pool (spart Zeit, hält das 3er-Limit): `python3 scripts/art/characters.py batch walk:foltan pose:foltan:sit,lie portrait:foltan ref:azar`. Achtung: `--extra`/`--suffix` gelten für alle Aufträge des Batches.

`characters.py build <ids>` verarbeitet nur vorhandene Rohbilder neu (Referenz, Laufblatt, Posen, Porträts, QA, Manifest). `characters.py list` zeigt den Stand.

**Alle 45 Menschen-Figuren stehen in `cast.json`** (auch die der Batches `chars-prolog-hof` und `chars-reise`). Batch-Felder: `rawDir` (Ordner der Rohbilder, z. B. `output/imagegen/raw/chars-reise/foltan`), `record` (Protokolldatei `docs/rebuild/art/<record>.json`), `sex` (`m`/`f`) bzw. `portraitStyle` (`male`/`female`) für die Porträt-Stilreferenz einer deutlich anderen Person, `styleAnchor` (Stil-Anker für den Referenzbogen statt `lia`), `portraitFrom` (`{id, edit}`: neutrales Porträt als Bearbeitung eines anderen Porträts, z. B. `baris-scarred`), `build.magentaAllow` (erlaubte magentaähnliche Pixel, violette Magie von Vamir), `build.widePoses` (Posen mit breiter Zelle; Standard `attack`, `shoot`). Neue Posen für vorhandene Figuren daher einfach: `python3 scripts/art/characters.py pose foltan --poses=carry` (neue Pose vorher in `POSES` ergänzen).

Bekannte Posen (`POSES` in `prompts.py`): sit, kneel, crouch, hurt, read, sit-read, cast (Farbe des Leuchtens über `POSE_EXTRA`, Türkis nur für die Urmacht), lie, attack, shoot, talk, interact, fall. **attack/shoot** bekommen eine **96×64-Zelle** (Fußanker 48, 60, Anker = Standfläche), damit Waffen nicht geschrumpft werden. Stimmungen (`MOODS`): neutral, happy, sad, angry, surprised, determined, hurt, pained, thinking, scared, worried, ashamed, smirk, grim.

Sonderfälle: **Tiere** (Hund, Pferd, Schwein, Huhn, Hase, Krähe, Hirsch) mit `python3 scripts/art/creatures.py` (Schwerpunkt-Anker statt Kopfmitte, Vierbeiner-Gangarten, Krähen-Flugstreifen, Requisitenbögen; Spezifikation `scripts/art/creatures.json`). **Reiter** (`shadow-rider`) mit `python3 scripts/art/rider.py ref|walk|build`.

## 2. Kartenhintergrund

```
python3 scripts/art/backgrounds.py bg hof --size=1280x720 --desc="a small farmstead at the end of a sunken lane at golden evening: half-timbered farmhouse with thatched roof on the left, a larger barn on the right, pigsty and a small grove behind, open dirt yard in the middle"
```
Ergebnis `game/public/assets/bg/hof.png` (640×360 = ein Bildschirm, 1280×720 = scrollend), deckend, Drei-Viertel-Draufsicht. Referenzen: Selantis-Landschaften aus `output/imagegen/style-refs/` (Standard) oder `--refs=a.png,b.png`. Nachbearbeitung erneut: `backgrounds.py build-bg hof [--focus=0.4] [--colors=96]` (16:9-Zuschnitt mit vertikalem Fokus, Lanczos, leichtes Nachschärfen, Paletten-PNG mit 192 Farben — etwa halbe Dateigröße; `--colors=0` = Echtfarben). Polygon-Geometrie (begehbar, Verdecker, Ausgänge) gehört der Welt-Engine (`world/`), nicht dem Manifest; Zusatzdaten können als Sidecar `bg/<id>.json` neben das Bild gelegt werden und erscheinen dann im Manifest-Eintrag.

## 3. Requisit

```
python3 scripts/art/props.py bucket --height=14 --desc="a wooden water bucket with iron bands and a rope handle"
python3 scripts/art/props.py campfire --frames=4 --fps=8 --height=22 --light=70,#ffb060,flicker --footprint=-8,-5,16,5 --desc="a small campfire in a ring of stones with burning logs"
python3 scripts/art/props.py tree-oak --height=120 --sway --footprint=-10,-8,20,8 --desc="a large old summer oak tree with a broad crown"
```
Ergebnis `props/<id>.png` (zugeschnitten, transparent, harte Alpha) + Sidecar `props/<id>.json` mit `anchor` (Standard unten Mitte), `footprint` (Kollision relativ zum Anker; Standard: unterer Streifen 80 % breit, 25 % / max. 12 px hoch; `--footprint=none` = keine Kollision), `frames`/`frameW`/`fps` (Animation als Streifen), `sway`, `light`, `lights`, `anchors` (benannte Punkte wie `door`, `seat` — von Hand im Sidecar ergänzen). Animationsframes werden an ihrer Basis (Mitte der untersten Pixelzeilen) ausgerichtet, damit der feste Teil (z. B. der Steinkreis) nicht zittert. `props.py build <id>` ohne Optionen reproduziert aus dem Sidecar (Anker wird neu berechnet; `--keep-anchor` behält einen von Hand gesetzten). Varianten: `<id>-v2`, `<id>-v3` … werden von `G.art.prop(scene, id, variant)` gewählt.

## 4. Tafel / Cutscene

```
python3 scripts/art/backgrounds.py plate wiese-lesen --chars=lia --desc="Lia sits barefoot under a big summer oak at the edge of a meadow, reading an old book, late afternoon light"
```
Ergebnis `cut/<id>.jpg` 1280×720, ≤ 400 KB (Qualität wird automatisch gesenkt). Figuren nur über `--chars` (deren Referenzbögen), nie über Filmbilder.

## 5. Itemsymbole

```
python3 scripts/art/icons.py gen story-1 --cols=4 --items="book-alana:an old leather-bound storybook with a golden star on the cover; dagger:a small dagger in a brown leather sheath; …"
```
Der Bogen muss voll sein (Zeilen × Spalten = Anzahl). Einzelsymbole landen in `docs/rebuild/art/icons/<id>.png`, der Atlas in `game/public/assets/ui/items.png` (8 Spalten à 32×32) + `ui/items.json`. `icons.py build` baut alles neu, spätere Bögen ersetzen gleichnamige Symbole.

## 6. Manifest

`python3 scripts/art/build_manifest.py` (läuft am Ende jedes Skripts automatisch; `--check` prüft nur) scannt `game/public/assets/` und schreibt `manifest.json`. **Wer Dateien von Hand ablegt, ruft es danach auf.** Typen: `game/src/art/manifest.ts`.

```jsonc
{
  "version": 1,
  "characters": {            // aus sprites/<id>-walk.png und sprites/<id>-<pose>[-<dir>].png (+ Sidecar .json)
    "lia": {
      "walk": { "file": "assets/sprites/lia-walk.png", "frameW": 64, "frameH": 64, "cols": 4, "rows": 4,
                "dirs": ["down", "left", "right", "up"], "fps": 8 },
      "foot": [32, 60], "height": 40,
      "poses": { "sit": { "file": "assets/sprites/lia-sit.png", "w": 64, "h": 64, "frames": 1, "foot": [32, 60],
                          "facing": "right", "dirs": { "left": { … } } } }
    }
  },
  "portraits": { "lia": { "neutral": "assets/portraits/lia.png", "happy": "assets/portraits/lia-happy.png" } },
  "backgrounds": { "hof": { "file": "assets/bg/hof.png", "w": 1280, "h": 720 } },   // + Sidecar-Felder
  "plates": { "wiese-lesen": { "file": "assets/cut/wiese-lesen.jpg", "w": 1280, "h": 720 } },
  "props": { "campfire": { "file": "assets/props/campfire.png", "w": 24, "h": 22, "frames": 4, "fps": 8,
                           "anchor": [12, 22], "footprint": { "x": -8, "y": -5, "w": 16, "h": 5 },
                           "light": { "radius": 70, "color": "#ffb060", "flicker": true } } },
  "icons": { "atlas": "assets/ui/items.png", "cell": 32, "cols": 8, "ids": { "dagger": 0 } },
  "images": { "ui/title": { "file": "assets/ui/title.png", "w": 1280, "h": 720 } }  // alles andere
}
```
Namensregeln: Posen-Suffixe werden gegen die bekannten Figuren-IDs (`cast.json`, vorhandene Laufblätter) aufgelöst, d. h. `lia-cloak-sit.png` → Figur `lia-cloak`, Pose `sit`. Porträt-Stimmungen sind feste Wörter (`MOODS` in `build_manifest.py`); alles andere ist eine eigene Porträt-ID. Bei Zweifeln Sidecar `{"character": "…", "pose": "…"}` neben das Bild legen.

## 7. Laufzeit (`G.art`)

- `await G.art.preload(scene, { characters: ['lia'], props: ['campfire'], backgrounds: ['hof'], plates: ['wiese-lesen'] })` im `create()` der Szene. Danach sind die Texturen gemalt. Alles ist schon vorher synchron nutzbar: vorhandene Bilder starten mit einer Blurhash-Vorschau in derselben Geometrie und werden beim Laden in-place ersetzt. Bei fehlenden Bildern bleibt der prozedurale Platzhalter.
- `const key = G.art.character(scene, 'lia')`; Sprite mit `setOrigin(G.art.characterAnchor(key).x, …y)` (= (0.5, 60/64)), Animationen `G.art.animKey(key, 'walk', 'left')`. `walk`/`run`/`sneak`/`carry` nutzen die Laufzeilen (8/12/5/7 fps), `idle` = erster Frame der Laufzeile (oder eigene `idle`-Pose), übrige Animationen die Posen mit Fallback-Ketten (`sit → kneel → idle`, `hit → hurt`, `sleep/fall → lie`, `sit-read ↔ read`, …), links automatisch gespiegelt.
- `G.art.background(scene, id)`, `G.art.prop(scene, id)` (PropInfo inkl. Footprint/Licht/Animation), `G.art.portrait(id, mood)` (URL; fehlende Stimmung → verwandte Stimmung → neutral; unbekannte ID → Kapuzen-Silhouette), `G.art.plateUrl(id)`, `G.art.hasAsset(kind, id)`, `G.art.icon(scene, id)` / `iconDataUrl(id)` (Atlas `ui/items.png`, sonst neutrales Bündel-Symbol als Platzhalter).
- Zusätze (`G.art as ArtApi & ArtExtras`, Import aus `art/index.ts`): `manifest()`, `assetIds(kind)`, `poseIds(id)`, `moodIds(id)`.
- Jede weitere Pose aus dem Manifest (Tierposen wie `graze`, `peck`, `fly`, oder `hurt`) ist unter ihrem eigenen Namen abspielbar: `G.art.animKey(key, 'graze' as CharAnimExtra, 'right')`.
- Effekttexturen `fx-*` bleiben prozedural (Partikel, Licht). Prozedurale Kacheln, Requisiten, Figuren und Symbole gibt es nicht mehr.

### Bildvorschauen

`npm run images:prepare --prefix game` erzeugt `game/src/art/blurhashes.json` für alle PNG-, JPEG- und WebP-Bilder unter `game/public`. Dafür werden Python 3 mit Pillow und die installierten Spielabhängigkeiten gebraucht. Laufblätter, Posenstreifen und der Gegenstandsatlas erhalten einzelne Vorschauen pro Frame. Ein zusätzlicher Hash bewahrt den Alphakanal transparenter Bilder. SHA-256-Werte berücksichtigen Bild, Sidecar und Encodereinstellungen; unveränderte Dateien werden wiederverwendet.

Der Entwicklungsserver aktualisiert die Metadaten beim Start automatisch. Der Produktionsbuild prüft sie mit `--check` und bricht bei fehlenden oder veralteten Einträgen ab. Diese Prüfung benötigt kein Python. Nach neuen oder geänderten Bildern die Metadaten zusammen mit den Bildern einchecken.

DOM-Bilder über `setImageSource(img, url, { lazy: true })` aus `ui/image.ts` setzen. Die Vorschau ist sofort verfügbar; das Original ersetzt sie nach dem Decodieren. Galerie-Vorschaubilder laden das Original erst nahe am sichtbaren Bereich. Bei Ladefehlern bleibt die Vorschau. Canvas-Texturen verwenden `drawPreview` aus `art/blurhash.ts`; `previewCanvas` liefert für bestehende Sprite-Crops die native Blattgeometrie.

Bei mehreren Python-Installationen kann `SELANTIS_IMAGE_PYTHON=/pfad/zu/python3` den Interpreter mit Pillow auswählen. Die Produktionsprüfung verwendet nur Node und die gespeicherten Hashes.

## 8. Qualitätsprüfung (Pflicht)

1. **Jedes Rohbild ansehen** (Read-Werkzeug): falsche Anatomie, zusätzliche Gliedmaßen, Schrift, falscher Stil, abweichendes Figurendesign, abgeschnittene Figuren → neu erzeugen (`--suffix`, `promote`).
2. **Laufzyklus**: `python3 scripts/art/qa.py walk <id>` → `output/imagegen/preview/art/<id>-walk-strip.png` ansehen: Spalten 1–4 = Frames, Spalte 5 = Zwiebelhaut aller Frames (Kopf muss scharf bleiben, Beine/Arme fächern auf), rote Linie = Grundlinie y = 60, blaue Linie = x = 32. Kennzahlen im Terminal (Kopf-Zittern, Grundlinie, Beinbewegung, `alt13`). GIF: `<id>-walk.gif`.
3. **Kontaktbogen**: `python3 scripts/art/qa.py contact <id>` → Referenz | Laufblatt | Posen | Porträts nebeneinander (Konsistenz von Gesicht, Farben, Proportionen).
4. **Im Spiel**: Galerie `?scene=art-gallery&page=walk|poses|portraits|props|backgrounds|fx` (Figuren in Originalgröße über einem gemalten Hintergrund, Posen links/rechts, Porträts mit Stimmungen, Requisiten mit Footprint-Rahmen und Anker, Symbole, Hintergründe, Tafeln). Smoke-Test: `cd game && npx playwright test` (lädt jede Demo, auch die Galerie).
5. `python3 scripts/art/build_manifest.py --check` ohne Warnungen.
6. Provenienz: Wurde ein Generator-Lauf abgebrochen, trägt `python3 scripts/art/gen.py sync` fehlende Einträge aus `output/imagegen/log.jsonl` in `docs/rebuild/art/<bereich>.json` nach.

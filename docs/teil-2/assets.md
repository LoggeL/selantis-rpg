# Teil II „Letzte Hoffnung“: Assetbedarf und Herkunft

Alle neuen Bilder entstehen über die vorhandene Codex-Pipeline (`scripts/art/`, `codex_image.sh`). Figuren nur nach den
Referenzbögen in `docs/rebuild/art/refs/` und der Figuren-Referenz in `DESIGN.md` §3. Filmframes (`sources/frames/`)
sind ausschließlich Handlungsbelege und werden **nie** als Bildreferenz angehängt. Türkis gehört allein der Urmacht,
Vamirs Magie ist kalt violett, Ignatius' Magie ist warmes Bernsteingold (Adaption, nur in seiner Schlafgeste sichtbar).

Protokoll der Generatorläufe: `docs/rebuild/art/teil-2.json` (`--area=teil-2`). Rohbilder unter `output/imagegen/raw/`.

## Wiederverwendet

| Asset | Verwendung |
| --- | --- |
| `bg/k3-eber` | `e2-eber` (begründete Rückkehr zum Goldenen Eber) |
| `bg/k4-waldpfad` | `e2-waldposten` (Kontrollposten der Bruderschaft) |
| `bg/k4-lager` | `e2-lager`, `e2-lager-nacht` (bekanntes Lager der Bruderschaft) |
| `bg/k4-bach` | `e2-bach-flucht` (Flucht aus dem überfallenen Lager) |
| Figuren `lia-cloak`, `kyra`, `kyra-bound`, `flick`, `elnon`, `alastir`, `foltan`, `azar`, `craupor`, `vamir`, Dunkelschatten, `ghoul`, `guard-brotherhood`, `elf-m`, `elf-f`, `dwarf`, `barmaid`, `bard`, `merchant`, `villager-*` | wie im ersten Buch |
| Porträts `baris-scarred`, `lia-cloak-*`, `flick-*`, `kyra-*`, `elnon-*`, `foltan-*`, `azar-*` | Dialoge |
| Musik `tavern`, `exploration`, `refuge`, `dread`, `battle`, `flight`, `grief` | Stimmungen |

## Neu: Kartenhintergründe

| ID | Größe | Inhalt |
| --- | --- | --- |
| `e2-ignatius-lager` | 1280×720 | Waldlichtung des Einsiedlers: Unterstand an einer alten Buche, Feuerstelle, Holzstapel, Bach am Rand, Übungsplatz mit Baumstümpfen, Wege nach Süden und Osten |
| `e2-halle` | 640×360 | Vamirs gewölbte Halle: Podest mit hohem dunklem Stuhl, schwerer Holztisch, Verhörstuhl mit Eisenring, Kohlebecken, Tür unten, Seitentür zu den Zellen |
| `e2-kerker` | 640×360 | Kerkergang mit drei vergitterten Zellen, Wachtisch mit Laterne, Eisenringe, Treppe/Tür als Ausgang |
| `e2-herbsthang` | 1280×720 | Herbstlicher Hang mit Gebüsch, gewundener Pfad, ein Stück weißes Leinen im Busch, Blick ins Tal |

## Neu: Figurenvarianten und Posen

| ID | Basis | Inhalt | Posen |
| --- | --- | --- | --- |
| `e2-lia-stab` | `lia-cloak` | Lia in Reisekleidung, Mantel über die Schultern zurückgeschlagen, trägt Schattentöter (langer naturbelassener Stab mit Knorren, Lederwicklung) | cast (kleines türkises Licht an der Stabspitze), attack (Stabschwung), sit, kneel, lie, hurt |
| `e2-ignatius` | `ignatius` | Ignatius sechzehn Jahre nach Dunkelhain: älter, ungestutzter weißer Bart, verblichene geflickte rot-orange Robe unter braunem Waldumhang, kein Stab | sit, kneel, talk, carry (Arm voll Feuerholz), cast (bernsteingoldenes Licht) |
| `e2-druide` | neu | Druide der Bruderschaft: älterer Mann, graue Zöpfe mit Holzperlen, grau-grüne Wollrobe, Kräuterbeutel, Holzschale | kneel, talk, interact |
| `e2-flick-gefangen` | `flick` | Flick ohne Bogen/Köcher/Messer, eiserne Handschellen mit kurzer Kette, staubig, Schramme an der Wange | sit, sit-chair, kneel, crouch, lie, hurt |
| `e2-elnon-gefangen` | `elnon` | Elnon ohne Axt, Tunika eingerissen, Prellungen, Handschellen | kneel, sit, lie, hurt, fall |
| `e2-kyra-gebannt` | `kyra-bound` | Kyra ohne Fesseln, starrer Blick mit schwachem violettem Schimmer in den Augen, kurzes Schwert | attack, kneel, lie |
| `baris-scarred` | `baris` | Baris nach Vamirs Strafe: eine verbrannte Gesichtshälfte, ein milchig-blindes Auge (wie Porträt `baris-scarred`) | kneel, attack, talk |

Porträts: `e2-ignatius` (neutral, happy, thinking, sad, worried, determined, grim), `e2-druide` (neutral, worried,
surprised, grim), `e2-kyra-gebannt` (neutral), zusätzliche Stimmungen `elnon` (hurt, pained, ashamed, determined),
`flick` (hurt, pained, scared), `kyra-bound` (pained).

## Neu: Tafeln (1280×720)

| ID | Inhalt |
| --- | --- |
| `e2-pruefung` | Lia kniet in der Abenddämmerung im Lager, türkises Licht bricht aus ihr, zwei Rebellen halten ihre Arme, Elnon weicht zurück, der Druide hält die leere Schale |
| `e2-sehkugel` | Eine bleiche knochige Hand aus schwarzem Ärmel über einer handgroßen Kristallkugel, darin ein winziges türkises Leuchten, violette Reflexe |
| `e2-trennung` | Lager vor der Morgendämmerung, Fackeln und Lagerfeuer, nichts brennt: Flick und Elnon sitzen gefesselt an der Palisade, ein Kapuzen-Scherge im schwarz-weißen Wappenrock schleift Kyra heran, der vernarbte Baris erkennt Flick |
| `e2-bericht-xenovia` | Kohlezeichnung auf Birkenrinde (Ignatius' Bericht): zehn Menschen um eine stürzende Göttin, die in den Wellen versinkt; eine versiegelte Höhle mit Licht |
| `e2-bericht-wiege` | Kohlezeichnung auf Birkenrinde: verwundeter Magier ohne Stab hebt die Hand über eine Wiege mit zwei Säuglingen, ein Bauernpaar in der Tür |
| `e2-erinnerung` | Erinnerungsbild mit violettem Rand: eine brennende Stadt bei Nacht aus der Ferne, Silhouetten von Gefangenen in einer Reihe, keine Gewaltdetails |
| `e2-schattentoeter` | Morgen im Lehrerlager: Ignatius reicht Lia den Stab Schattentöter |
| `e2-kontrolle` | Gewölbe: Kyra mit violettem Glanz in den Augen hält ein Schwert, Elnon gefesselt vor ihr, Vamirs Schatten mit Hand auf ihrer Schulter, kein Blut |
| `e2-flucht` | Kerker: Flick an der offenen Zellentür blickt zurück zu Elnon, der neben der bewusstlosen Kyra sitzt; offene Handschellen am Boden |
| `e2-vamir-anhoehe` | Vamir auf sonniger Anhöhe mit erhobenen Armen, violette Blitze am Himmel; nur Wälder, Hügel, ein See – keine Stadt, keine Gebäude |
| `e2-stadtwache` | Steinerne Brüstung in der Dämmerung, eine einzelne Wache (Kettenhaube, Helm, Speer, weiß-dunkelblauer Wappenrock) blickt über bewaldetes Hügelland auf eine violette Blitzsäule am Horizont; keine Stadt, keine Gebäude |
| `e2-aufbruch` | Lia mit Schattentöter im herbstlichen Gebüsch, goldrotes Laub, Morgenlicht; dahinter nur nebelige Waldhügel – keine Gebäude |

## Neu: Itemsymbol

`e2-schattentoeter` (32×32, langer knorriger Holzstab) im Atlas `ui/items.png`.

## Status

| Asset | Datei | Größe | Stand |
| --- | --- | --- | --- |
| `bg/e2-ignatius-lager` | `game/public/assets/bg/e2-ignatius-lager.png` | 1280×720, 747 KB | fertig (v1), Rohbild geprüft |
| `bg/e2-halle` | `game/public/assets/bg/e2-halle.png` | 640×360, 194 KB | fertig (v1), Rohbild geprüft; Stilreferenz zusätzlich `bg/prolog-rat` |
| `bg/e2-kerker` | `game/public/assets/bg/e2-kerker.png` | 640×360, 193 KB | fertig (v1), Rohbild geprüft; Stilreferenz zusätzlich `bg/prolog-rat` |
| `bg/e2-herbsthang` | `game/public/assets/bg/e2-herbsthang.png` | 1280×720, 683 KB | fertig (v2 übernommen; v1 verworfen: flache Landschaftsperspektive, zu großer Maßstab, Burg im Tal) |
| Figurenvarianten, Posen, Porträts | `sprites/`, `portraits/` | – | Schritt 2: fünf Figuren fertig (siehe „Status Figuren“); Schritt 4: `e2-elnon-gefangen`, `e2-kyra-gebannt` und Zusatzstimmungen fertig (siehe „Status Schritt 4“) |
| Tafeln | `game/public/assets/cut/e2-*.jpg` | 1280×720, je ≤ 400 KB | Schritt 3: alle zwölf fertig (siehe „Status Tafeln“); Schritt 5: `e2-trennung` und `e2-stadtwache` nach der Quellenprüfung neu |
| Itemsymbol `e2-schattentoeter` | `game/public/assets/ui/items.png` (Zelle 26) | 32×32 | fertig (Schritt 4) |

## Status Figuren (Schritt 2)

Erzeugt mit `scripts/art/characters.py` (`--area=teil-2`, höchstens 2 parallele Aufträge). Jedes Rohbild wurde angesehen, die
Laufblätter mit `qa.py walk` geprüft (keine „legs do not alternate“-Warnung) und jede Figur mit `qa.py contact`
kontrolliert. Referenzbögen unter `docs/rebuild/art/refs/<id>.png`, Provenienz in `docs/rebuild/art/teil-2.json`
(`baris-scarred`-Bauprotokoll weiter in `chars-reise.json`). Neue Posen in `scripts/art/prompts.py`: `sit-chair`, `carry`.

| Figur | Basis | Höhe | Laufblatt | Posen | Porträts | Anmerkungen |
| --- | --- | --- | --- | --- | --- | --- |
| `e2-lia-stab` | `lia-cloak` | 41 | `sprites/e2-lia-stab-walk.png` | cast, attack, sit, kneel, lie, hurt | – (nutzt `lia-cloak-*`) | Höhe 41 statt 40, weil der Stab im Laufblatt über den Kopf ragt (Körper ≈ 40 px). Cast: kleines türkises Licht nur an der Stabspitze. Attack ist ein kurzer, kontrollierter Stabstoß (96×64-Zelle) |
| `e2-ignatius` | `ignatius` | 43 | `sprites/e2-ignatius-walk.png` | sit, kneel, talk, carry, cast | neutral, happy, thinking, sad, worried, determined, grim | Neutrales Porträt als Bearbeitung von `ignatius` (`portraitFrom`). Talk aus v2 übernommen (v1 hatte keine goldene Borte am Gewand). Cast mit bernsteingoldenem Licht an der rechten Hand |
| `e2-flick-gefangen` | `flick` | 41 | `sprites/e2-flick-gefangen-walk.png` | sit, sit-chair, kneel, crouch, lie, hurt | – (nutzt `flick-*`) | Eisenschellen mit kurzer Kette, keine Waffen. `sit-chair` enthält den Holzstuhl im Sprite |
| `e2-druide` | neu (Stil-Anker `valentus`) | 43 | `sprites/e2-druide-walk.png` | kneel, talk, interact | neutral, worried, surprised, grim | Interact: Holzschale in der linken Hand, streut Kräuter hinein |
| `baris-scarred` | `baris` | 52 | `sprites/baris-scarred-walk.png` | kneel, attack, talk | neutral, pained (unverändert, vorhanden) | Eigener Referenzbogen `refs/baris-scarred.png`: rechte Gesichtshälfte verbrannt, rechtes Auge milchig (wie Porträt). Palette 40 Farben wie `baris`. Laufblatt in Schritt 5 neu erzeugt (v1 hatte hellere, bräunliche Rüstung und rote Riemen): jetzt fast schwarze Rüstung mit dunklen Riemen |

Laufzeit: `carry` ist in `game/src/art/sprites.ts` bereits als Animation mit Pose `carry` angelegt, `G.art` spielt also
die neue Einzelpose `e2-ignatius-carry` ab.

## Status Tafeln (Schritt 3)

Erzeugt mit `scripts/art/backgrounds.py` (Plate-Prompt, Aufbau `build-plate`), höchstens 2 parallele Aufträge in einem Prozess, Provenienz in `docs/rebuild/art/teil-2.json` (verworfene Fassungen als `*-rejected-1.png` mit Grund), Einstellungen unter `plate:<id>` in `docs/rebuild/art/backgrounds.json`. Figuren nur über ihre Referenzbögen; Tafeln ohne Figuren ohne Bildreferenz. Jedes Rohbild wurde angesehen.

| Tafel | Datei | Größe | Referenzbögen | Fassung | Anmerkungen |
| --- | --- | --- | --- | --- | --- |
| `e2-pruefung` | `game/public/assets/cut/e2-pruefung.jpg` | 1280×720, 381 KB | `lia-cloak`, `elnon`, `e2-druide` | v1 | Zwei Rebellenwachen (rot-weiß) von hinten halten Lias Arme, türkiser Ausbruch, Augen leuchten blau-türkis; Elnon schirmt das Gesicht ab, Druide mit leerer Schale |
| `e2-sehkugel` | `game/public/assets/cut/e2-sehkugel.jpg` | 1280×720, 216 KB | – | v1 | Bleiche, knochige Hand mit langen Nägeln aus schwarzem Ärmel, Fingerspitze berührt die Kugel; winziger türkiser Funke, violette Reflexe |
| `e2-trennung` | `game/public/assets/cut/e2-trennung.jpg` | 1280×720, 355 KB | `kyra-bound`, `e2-flick-gefangen`, `elnon`, `baris-scarred`, `shadow-sword` | v3 (Schritt 5) | v1 verworfen: Sonnen-Emblem statt schwarz-weiß geviertelt, Baris sah nicht auf Flick. v2 verworfen (Quellenprüfung §4): brennendes Lager, Kyra von zwei Soldaten gehalten, Flick kniend. v3: Lager vor der Dämmerung, unversehrte Zelte, Fackeln und ruhiges Lagerfeuer; Flick (Schellen) und Elnon (Stricke, ohne Axt) sitzen an der Palisade; Kapuzen-Scherge im geviertelten Wappenrock zerrt Kyra am Arm heran (Haar offen wie auf dem Bogen); Baris mit verbrannter rechter Gesichtshälfte und milchigem Auge blickt finster auf Flick; kein Blut |
| `e2-bericht-xenovia` | `game/public/assets/cut/e2-bericht-xenovia.jpg` | 1280×720, 381 KB | – | v1 | Kohle/Ocker auf Birkenrinde im Moos; zehn Figuren mit erhobenen Armen, Göttin in Wellen, versiegelte Höhle mit türkisem Licht als einziger Farbe |
| `e2-bericht-wiege` | `game/public/assets/cut/e2-bericht-wiege.jpg` | 1280×720, 292 KB | `valentus` (Identitätshinweis) | v2 | v1 verworfen: rotes Blut an der Wunde. v2: Magier ohne Stab hält die Seite, türkises Leuchten an der Hand als einzige Farbe, Bauernpaar in der Tür |
| `e2-erinnerung` | `game/public/assets/cut/e2-erinnerung.jpg` | 1280×720, 288 KB | – | v1 | Violette Vignette, brennende ummauerte Stadt aus der Ferne, kniende Gefangene und Bewaffnete nur als Silhouetten, keine Gewalt |
| `e2-schattentoeter` | `game/public/assets/cut/e2-schattentoeter.jpg` | 1280×720, 389 KB | `e2-ignatius`, `e2-lia-stab` | v1 | Morgen im Einsiedlerlager (Unterstand an der Buche, Feuer, Holzstapel); Ignatius reicht den Knorrenstab, Lia greift danach. Lia trägt den Mantel wie bei `lia-cloak` über beiden Schultern |
| `e2-kontrolle` | `game/public/assets/cut/e2-kontrolle.jpg` | 1280×720, 337 KB | `kyra-bound`, `elnon`, `vamir` | v2 | v1 verworfen: Fesseln an Kyras Handgelenken, Vamirs Hände als Skelett. v2: Kyra ohne Fesseln mit Kurzschwert, violetter Schimmer in den Augen, Elnon in Ketten, Vamirs bleiche Hand auf ihrer Schulter, kein Blut |
| `e2-flucht` | `game/public/assets/cut/e2-flucht.jpg` | 1280×720, 357 KB | `e2-flick-gefangen`, `elnon`, `kyra-bound` | v1 | Flick in der offenen Zellentür, offene Handschellen am Boden, Elnon winkt sie fort, Kyra bewusstlos im Stroh; Wache klein am Gangende |
| `e2-vamir-anhoehe` | `game/public/assets/cut/e2-vamir-anhoehe.jpg` | 1280×720, 390 KB | `vamir` | v4 (Schritt 6) | v1 verworfen: Skeletthände. v2 verworfen (Quellenprüfung §7): Burg und Stadt auf einem Hügel, Dorf am See. v3 verworfen: heller Fleck am Seeufer liest sich als Hütte. v4: Kapuze ohne Gesicht, bleiche dünne Hände mit Haut, violette Blitze am klaren Himmel; dahinter nur bewaldete Hügel und ein See mit bewaldeten Ufern, keine Gebäude |
| `e2-stadtwache` | `game/public/assets/cut/e2-stadtwache.jpg` | 1280×720, 309 KB | – | v2 (Schritt 5) | v1 verworfen (Quellenprüfung §7): Dächer und Türme einer Stadt, nur schwaches Flackern. v2: Wache von hinten auf steinerner Brüstung, Kettenhaube und Helm, Speer, weiß-dunkelblau geteilter Wappenrock ohne Zeichen; endloses Waldhügelland, violette Blitzsäule am Horizont in den Wolken; keine Stadt, keine Gebäude |
| `e2-aufbruch` | `game/public/assets/cut/e2-aufbruch.jpg` | 1280×720, 255 KB | `e2-lia-stab` | v2 (Schritt 6) | v1 verworfen (Quellenprüfung §7): Stadt mit Kirchturm auf einer Klippe, Steinbrücke, Burgruine. v2: Lia geht seitlich nach rechts durch goldrotes Gebüsch und Birken, Stab als Wanderstab, Morgensonne; dahinter nur nebelige Waldhügel, keine Gebäude |

## Status Schritt 4 (Restvarianten, Zusatzstimmungen, Itemsymbol, Abschluss-QA)

Erzeugt mit `scripts/art/characters.py` bzw. `scripts/art/icons.py`, höchstens 2 parallele Codex-Aufträge, jedes Rohbild
angesehen, Laufblätter mit `qa.py walk` (keine „legs do not alternate“-Warnung) und beide Figuren mit `qa.py contact`
geprüft. Figuren nur über ihre Referenzbögen (`refs/elnon.png`, `refs/kyra-bound.png` als Identitätsreferenz). Neue
Einträge in `scripts/art/cast.json` (`e2-elnon-gefangen`, `e2-kyra-gebannt`) und `POSE_EXTRA` in `scripts/art/prompts.py`.

| Asset | Datei(en) | Größe | Provenienz | Fassung / Abweichungen |
| --- | --- | --- | --- | --- |
| Referenzbogen `e2-elnon-gefangen` | `docs/rebuild/art/refs/e2-elnon-gefangen.png` | 1378×972 | `teil-2.json` | v1. Ohne Axt, Tunika an der rechten Schulter eingerissen, Prellungen an Wange und Schläfe, Eisenschellen mit kurzer Kette |
| Laufblatt `e2-elnon-gefangen` | `sprites/e2-elnon-gefangen-walk.png` (+ `.json`) | 256×256, Höhe 46 | `teil-2.json` | v1 |
| Posen `e2-elnon-gefangen` | `sprites/e2-elnon-gefangen-{kneel,sit,lie,hurt,fall}.png` (+ `.json`) | 64×64, lie 128×64 | `teil-2.json` | kneel, sit, lie, fall v1; hurt v2 (v1 verworfen: kurzärmeliges Hemd ohne Stickerei/Armschienen, als `pose-hurt-rejected-1.png` mit Grund protokolliert) |
| Referenzbogen `e2-kyra-gebannt` | `docs/rebuild/art/refs/e2-kyra-gebannt.png` | 1400×700 | `teil-2.json` | v1. Ohne Fesseln, starre Haltung, violetter Schimmer in den Augen, schlichtes Kurzschwert in der rechten Hand |
| Laufblatt `e2-kyra-gebannt` | `sprites/e2-kyra-gebannt-walk.png` (+ `.json`) | 256×256, Höhe 40 | `teil-2.json` | v1 |
| Posen `e2-kyra-gebannt` | `sprites/e2-kyra-gebannt-{attack,kneel,lie}.png` (+ `.json`) | attack 96×64, kneel 64×64, lie 128×64 | `teil-2.json` | v1. Attack: steifer gerader Stich; kneel/lie: Schwert liegt neben ihr am Boden. Der violette Augenschimmer ist in 40-px-Sprites nicht erkennbar (nur in Bogen und Porträt) |
| Porträt `e2-kyra-gebannt` (neutral) | `portraits/e2-kyra-gebannt.png` | 256×256 | `teil-2.json` | v1, Bearbeitung des neutralen `kyra-bound`-Porträts (`portraitFrom`). Leerer Blick, schwacher kalt-violetter Schimmer in der Iris, keine Fesseln. Die im Werkzeug fest eingebaute Ausdrucksvorgabe („hateful stare“) wurde per `--extra` überschrieben |
| Zusatzstimmungen `elnon` | `portraits/elnon-{hurt,pained,ashamed,determined}.png` | 256×256 | `teil-2.json` (Rohbilder unter `output/imagegen/raw/chars-reise/elnon/`) | v1, aus dem neutralen Porträt; vorhandene `elnon*.png` unverändert (nur die neuen Stimmungen einzeln gebaut) |
| Zusatzstimmungen `flick` | `portraits/flick-{hurt,pained,scared}.png` | 256×256 | `teil-2.json` (Rohbilder unter `output/imagegen/raw/chars-reise/flick/`) | v1 (hurt im 2. Versuch, 1. Codex-Lauf ohne Bild); vorhandene `flick*.png` unverändert |
| Zusatzstimmung `kyra-bound` | `portraits/kyra-bound-pained.png` | 256×256 | `teil-2.json` | v1; vorhandene `kyra-bound*.png` unverändert |
| Itemsymbol `e2-schattentoeter` | `docs/rebuild/art/icons/e2-schattentoeter.png`, Atlas `game/public/assets/ui/items.png` + `ui/items.json` | 32×32, Atlas 256×128 (27 Symbole) | `icons.json` (Bogen `e2-schattentoeter`, 1×1; `icons.py` protokolliert fest im Bereich `icons`) | v1, knorriger heller Holzstab diagonal mit Lederwicklung, ohne Stein/Metall/Leuchten. Nur dieser Bogen neu geschnitten; die 26 vorhandenen Atlaszellen sind pixelgleich |
| Manifest | `game/public/assets/manifest.json` | – | – | `build_manifest.py` und `--check` ohne Warnungen: 66 Figuren, 54 Porträt-IDs, 30 Hintergründe, 39 Tafeln, 80 Requisiten, 27 Symbole |

Anmerkungen:
- `ref_path()` in `characters.py` liefert für eine Figur mit `portraitFrom` ohne eigenen Bogen den Bogen der Basisfigur.
  Beim ersten `ref`-Lauf für `e2-kyra-gebannt` wurde deshalb `refs/kyra-bound.png` überschrieben; die Datei wurde aus
  ihrem unveränderten Rohbild neu gebaut (prüfsummengleich mit dem Stand davor) und `refs/e2-kyra-gebannt.png` danach
  separat erzeugt. Für künftige `portraitFrom`-Varianten zuerst den eigenen Bogen anlegen.
- `gen.py sync` ordnet nach Rohbild-Ordner zu und trug dabei die Teil-II-Rohbilder doppelt in `characters.json` und
  `backgrounds.json` ein. Diese Duplikate wurden wieder entfernt, die Provenienz steht vollständig in `teil-2.json`.
- Ein verwaister `codex exec`-Prozess aus Schritt 2 (Laufblatt `e2-ignatius`, seit 47 Minuten hängend) wurde beendet,
  bevor er das übernommene Rohbild überschreiben konnte. Das gebaute Laufblatt war davon nicht betroffen.

## Status Schritt 5 (Korrekturen nach der Quellenprüfung)

Zwei Tafeln widersprachen `docs/teil-2/quellenpruefung.md` (§4 Lagerangriff, §7 Schlusssequenz) und wurden neu erzeugt
(`backgrounds.py`-Plate-Prompt über einen Treiber mit `run_jobs`, 2 parallele Aufträge, `--area=teil-2`, Aufbau
`build-plate`). Figuren nur über ihre Referenzbögen, `e2-stadtwache` ohne Bildreferenz. Jedes Rohbild angesehen;
verworfene Fassungen bleiben als `*-rejected-N.png` mit Grund in `teil-2.json`, die übernommenen Rohbilder tragen
`promotedFrom`.

| Asset | Datei | Größe | Rohbild | Fassung / Anmerkungen |
| --- | --- | --- | --- | --- |
| Tafel `e2-trennung` | `game/public/assets/cut/e2-trennung.jpg` | 1280×720, 355 KB (q 82) | `raw/art/cut/e2-trennung-v3.png` → `e2-trennung.png`; v2 als `e2-trennung-rejected-2.png` | v3, siehe „Status Tafeln“. Im Hintergrund hängen schlichte hell-dunkel geteilte Fahnen ohne Zeichen |
| Tafel `e2-stadtwache` | `game/public/assets/cut/e2-stadtwache.jpg` | 1280×720, 309 KB (q 90) | `raw/art/cut/e2-stadtwache-v2.png` → `e2-stadtwache.png`; v1 als `e2-stadtwache-rejected-1.png` | v2, siehe „Status Tafeln“. Der 16:9-Zuschnitt kappt die Blitzsäule oben leicht, sie bleibt als Säule in den Wolken lesbar |
| Laufblatt `baris-scarred` | `sprites/baris-scarred-walk.png` (+ `.json`) | 256×256, Höhe 52 | `raw/chars-reise/baris-scarred/walk-v2.png` → `walk.png` (`characters.py promote`); v1 als `walk-rejected-1.png` | v2 mit `--extra`-Korrektur (fast schwarze Rüstung, dunkle Riemen). `qa.py walk` ohne Warnung. Rüstung jetzt so dunkel wie `baris` (mittlere Helligkeit 38 statt 46, `baris` 37); Riemen dunkel, nur Axtstiel und Gürtelkante bleiben rotbraun wie auf `refs/baris-scarred.png`. Neuaufbau mit gemeinsamer Palette: Posen `attack`, `kneel`, `talk` neu quantisiert (gleiche Rohbilder), Referenzbogen und Porträts prüfsummengleich. Bauprotokoll weiter in `chars-reise.json` |
| Manifest | `game/public/assets/manifest.json` | – | – | `build_manifest.py` und `--check` ohne Warnungen: 66 Figuren, 54 Porträt-IDs, 30 Hintergründe, 39 Tafeln, 80 Requisiten, 27 Symbole |

## Status Schritt 6 (Tafeln ohne Siedlungen, Quellenprüfung §7)

Laut `docs/teil-2/quellenpruefung.md` §7 zeigt der Film in der Schlusssequenz nur Landschaft, keine Stadt und keine Gebäude.
`e2-vamir-anhoehe` (v2: Burg, Stadt, Dorf) und `e2-aufbruch` (v1: Stadt auf Klippe, Brücke, Burgruine) wurden deshalb
neu erzeugt: `backgrounds.py`-Plate-Prompt über einen Treiber mit `run_jobs` (`--area=teil-2`, höchstens 2 parallele
Aufträge), Aufbau `build-plate`, kein `gen.py sync`. Figuren nur über ihre Referenzbögen (`refs/vamir.png`,
`refs/e2-lia-stab.png`). Der Prompt verbietet ausdrücklich Stadt, Häuser, Dächer, Türme, Burg, Ruinen, Dorf, Hof, Brücke,
Mauern und jedes Bauwerk. Jedes Rohbild angesehen (Hintergründe zusätzlich vergrößert geprüft). Verworfene Fassungen
bleiben als `*-rejected-N.png` mit Grund in `teil-2.json`, die übernommenen Rohbilder tragen `promotedFrom`; die neuen
Beschreibungen stehen unter `plate:<id>` in `docs/rebuild/art/backgrounds.json`. Spielcode wurde nicht angefasst.

| Asset | Datei | Größe | Rohbild | Fassung / Anmerkungen |
| --- | --- | --- | --- | --- |
| Tafel `e2-vamir-anhoehe` | `game/public/assets/cut/e2-vamir-anhoehe.jpg` | 1280×720, 390 KB (q 90) | `raw/art/cut/e2-vamir-anhoehe-v4.png` → `e2-vamir-anhoehe.png`; v2 als `-rejected-2.png`, v3 als `-rejected-3.png` | v4, siehe „Status Tafeln“. v3 hatte am Seeufer einen hellen Fleck, der als Hütte lesbar war |
| Tafel `e2-aufbruch` | `game/public/assets/cut/e2-aufbruch.jpg` | 1280×720, 255 KB (q 78) | `raw/art/cut/e2-aufbruch-v2.png` → `e2-aufbruch.png`; v1 als `-rejected-1.png` | v2, siehe „Status Tafeln“ |
| Manifest | `game/public/assets/manifest.json` | – | – | `build_manifest.py` und `--check` ohne Warnungen: 69 Figuren, 57 Porträt-IDs, 30 Hintergründe, 39 Tafeln, 82 Requisiten, 27 Symbole |

## Status Logge (Nutzerwunsch 2026-10-07: der Spielemacher als NPC)

Logge erscheint als reisender Chronist mit einer schwarzen Katze. Die Ähnlichkeit ist ausdrücklich gewünscht und vom
Nutzer selbst freigegeben – das ist die einzige Ausnahme von der Darsteller-Regel (`DESIGN.md` §2) und gilt nur für ihn.
Als Fotovorlage dienten nur private Gesichtsausschnitte unter `output/imagegen/private/` (ungetrackt). Sie werden nie
nach `game/public`, `docs` oder ins Repo kopiert; in `teil-2.json` steht nur der Ordner. Die Fotos wurden lediglich dem
Referenzbogen und dem neutralen Porträt beigelegt (eigener Treiber um `characters.jobs_for` + `gen.run_jobs`, dabei wurde
der feste `PRIVACY`-Satz durch eine Ähnlichkeitsvorgabe „nur Gesicht/Haare, stilisierte 16-Bit-Pixelkunst, nie
fotorealistisch“ ersetzt). Alles Weitere entstand mit dem normalen Werkzeug nach dem Bogen bzw. dem neutralen Porträt.
Höchstens 2 Codex-Aufträge liefen gleichzeitig. Jedes Rohbild wurde angesehen. Verworfene Fassungen bleiben als
`*-rejected-N.png` bzw. `-vN` mit Grund in `teil-2.json`, übernommene Rohbilder tragen `promotedFrom`. `refs/*.png`
anderer Figuren blieben unverändert (keine `portraitFrom`-Falle, `logge` hat keine Basisfigur).

| Asset | Datei(en) | Größe | Provenienz | Fassung / Abweichungen |
| --- | --- | --- | --- | --- |
| Figur `logge` | `scripts/art/cast.json` (`record: teil-2`, `_note`), `POSE_EXTRA`/`PORTRAIT_EXTRA` in `scripts/art/prompts.py` | Höhe 43 | – | Chronist: rostorange Tunika, Lederweste mit vielen Taschen, Umhängetasche mit Schriftrollen, Gänsekiel hinterm rechten Ohr, Tintenflecken an den Fingern, kleine runde orange getönte Drahtbrille ins Haar geschoben |
| Referenzbogen `logge` | `docs/rebuild/art/refs/logge.png` | 1400×932 | `teil-2.json` | v4 (`--extra`: schlichte Drahtbrille statt Schutzbrille, kurzes lockiges Haar). v1 (Brille als Steampunk-Brille mit Riemen), v2 (stachelige Haare), v3 (Haar zu braun/lang) verworfen. Ähnlichkeit: lockiges goldblondes Kurzhaar, blaugraue Augen, rötlicher Bartschatten, schiefes Halblächeln |
| Laufblatt `logge` | `sprites/logge-walk.png` (+ `.json`) | 256×256, Höhe 43 | `teil-2.json` | v1. `qa.py walk` ohne Warnung (Kopf-x 31,5–32,5, Beine wechseln in allen vier Richtungen) |
| Posen `logge` | `sprites/logge-{sit,talk,read,kneel}.png` (+ `.json`) | 64×64 | `teil-2.json` | sit v2: auf einem dreibeinigen Schemel, Knöchel auf dem Knie, schreibt mit dem Kiel in ein Büchlein (v1 verworfen: Haar/Gesicht wichen vom Bogen ab). talk v1: zeigt mit dem Kiel wie mit einem Zeigestock, grinst. read v1: Brille auf die Nase gezogen. kneel v1: auf einem Knie, hält einer Katze die Hand hin |
| Porträts `logge` | `portraits/logge.png`, `portraits/logge-{happy,smirk,surprised,thinking}.png` | 256×256 | `teil-2.json` | neutral v1 (mit Fotovorlagen; Halblächeln als Grundausdruck). happy v2 (breites Lachen) und smirk v2 (eine Braue hoch, verschmitzt, nicht böse); die v1 glichen dem neutralen Porträt. surprised, thinking (tintenfleckiger Finger am Kinn) v1 |
| Requisit `e2-katze` | `props/e2-katze.png` (+ `.json`) | 24×15, 2 Frames à 12 px, 2 fps, Anker (5, 15), ohne Footprint | `teil-2.json` | v1. Schwarze Katze sitzend, gelbgrüne Augen; Frame 2 hebt die Schwanzspitze (Kopf in beiden Frames auf gleicher x-Position) |
| Requisit `e2-katze-liegend` | `props/e2-katze-liegend.png` (+ `.json`) | 13×11, Anker (6, 11), ohne Footprint | `teil-2.json` | v1. Zusammengerollt schlafend, Schwanz um den Körper |
| Manifest | `game/public/assets/manifest.json` | – | – | `build_manifest.py` und `--check` ohne Warnungen: 67 Figuren, 55 Porträt-IDs, 30 Hintergründe, 39 Tafeln, 82 Requisiten, 27 Symbole |

Anmerkungen:
- Die Katzen haben `footprint: null`, damit sie keinen Weg versperren. Wer Kollision will, setzt sie im Sidecar und baut
  mit `props.py build <id> --keep-anchor` neu.
- Spielcode (`game/src/**`) wurde nicht angefasst. Szene und Gags von Logge müssen noch eingebaut werden.

## Status Sebastian und Pascal (Nutzerwunsch 2026-10-07: Wirtshausgäste nach privaten Fotos, Logge angetrunken)

Sebastian (NPC am Tisch mit Logge) und Pascal (einsamer Gast) entstanden nach privaten Gesichtsausschnitten unter
`output/imagegen/private/{sebastian,pascal}-refs/` (ungetrackt, 4 bzw. 3 Ausschnitte; laut Nutzer mit Einverständnis
der beiden). Das ist eine bewusste, in `cast.json` (`_note`) dokumentierte Ausnahme von `DESIGN.md` §2: Sebastian spielt im
Film 2 Valentus, Pascal im Film 1 eine Wache – die Spielfiguren sind ausdrücklich **nicht** diese Rollen und tragen
nichts von deren Kostüm (kein Gewand, kein Stab, keine Rüstung, keine Dunkelschatten-Kleidung). Technik wie bei Logge:
eigener Treiber um `characters.jobs_for` + `gen.run_jobs`, der den `PRIVACY`-Satz durch eine Ähnlichkeitsvorgabe
(„nur Gesicht/Haare, stilisierte 16-Bit-Pixelkunst, nie fotorealistisch; Kleidung, Hüte, Brillen, Mikrofone der Fotos
ignorieren“) ersetzt und die Fotos nur dem Referenzbogen und dem neutralen Porträt beilegt. In `teil-2.json` steht nur
der Ordner, keine Dateinamen; kein Foto wurde nach `docs`, `game/public` oder ins Repo kopiert. Alles Weitere entstand mit
dem normalen Werkzeug nach Bogen bzw. neutralem Porträt. Höchstens 2 Codex-Aufträge gleichzeitig, jedes Rohbild
angesehen. `refs/*.png` anderer Figuren blieben byteweise unverändert (Prüfsummen vor/nach verglichen).

| Asset | Datei(en) | Größe | Provenienz | Fassung / Abweichungen |
| --- | --- | --- | --- | --- |
| Figur `sebastian` | `scripts/art/cast.json` (`record: teil-2`, `_note`), `POSE_EXTRA`/`PORTRAIT_EXTRA` in `scripts/art/prompts.py` | Höhe 44 | – | Lautenspieler: dunkelgraues Wams mit langen Ärmeln, weißes Hemd, kleines dunkles Halstuch, dunkle Hose, schwarze Stiefel, Laute am Lederriemen auf dem Rücken |
| Referenzbogen `sebastian` | `docs/rebuild/art/refs/sebastian.png` | 1374×968 | `teil-2.json` | v2 (`--extra`: Haar dicht, dunkelbraun, zurück und hoch gekämmt; Wams mit Ärmeln). v1 verworfen (Haar wirr über der Stirn, ärmellose Weste). Ähnlichkeit: welliges Haar mit Volumen, gepflegter Schnurrbart mit kurzem Kinnbart, lebhafte Brauen, breites Grinsen |
| Laufblatt `sebastian` | `sprites/sebastian-walk.png` (+ `.json`) | 256×256, Höhe 44 | `teil-2.json` | v1. `qa.py walk` ohne Warnung (Kopf-x 31,6–32,4; Beine wechseln, `alt13` Ost mit 70 am niedrigsten, im Streifen aber klar) |
| Posen `sebastian` | `sprites/sebastian-{sit,talk,interact}.png` (+ `.json`) | 64×64 | `teil-2.json` | v1. sit: aufrecht auf kurzer Holzbank, Unterarme vorn, Hände gefaltet wie auf einer Tischkante – der Tisch ist **nicht** gezeichnet (kommt als Requisit davor). talk: theatralische Geste mit offener Hand. interact: spielt die Laute vor dem Bauch (Griffhand rechts im Bild) |
| Porträts `sebastian` | `portraits/sebastian.png`, `portraits/sebastian-{happy,surprised,worried,smirk}.png` | 256×256 | `teil-2.json` | alle v1; neutral mit Fotovorlagen (leichtes Lächeln, Blick zur Seite). happy eher warmes Lächeln als Lachen |
| Figur `pascal` | `scripts/art/cast.json` (`record: teil-2`, `_note`), `POSE_EXTRA`/`PORTRAIT_EXTRA` | Höhe 43 | – | Ausgeblichenes ziegelrotes Leinenhemd, dunkelbraune Hose mit leuchtend orangen Hosenträgern, Strohhut mit grünem Band, zwei Holzlöffel in der rechten Hand |
| Referenzbogen `pascal` | `docs/rebuild/art/refs/pascal.png` | 1368×910 | `teil-2.json` | v1. Ähnlichkeit: schmales Gesicht mit spitzem Kinn, kurzes hellbraunes Haar, helle Augen, trocken-skeptischer Mund |
| Laufblatt `pascal` | `sprites/pascal-walk.png` (+ `.json`) | 256×256, Höhe 43 | `teil-2.json` | v1. `qa.py walk` ohne Warnung (Kopf-x 31,5–32,5, Beine wechseln in allen Richtungen). Kleinigkeit: die Löffel wechseln im Lauf zwischen den Händen (bei 43 px kaum sichtbar) |
| Posen `pascal` | `sprites/pascal-{sit,talk}.png` (+ `.json`) | 64×64 | `teil-2.json` | v1. sit: allein auf dreibeinigem Schemel an einem **mitgezeichneten** kleinen runden Holztisch, trommelt mit je einem Löffel pro Hand. talk: hebt die Löffel wie einen Taktstock, Daumen unterm Hosenträger |
| Porträts `pascal` | `portraits/pascal.png`, `portraits/pascal-{smirk,thinking}.png` | 256×256 | `teil-2.json` | alle v1; neutral mit Fotovorlagen (skeptischer Seitenblick, Löffel in der Hand) |
| Pose `logge` `drunk-sit` | `sprites/logge-drunk-sit.png` (+ `.json`), neue Pose `drunk-sit` in `POSES` + `POSE_EXTRA` | 64×64 | `teil-2.json` | v1. Zusammengesunken auf einer Holzbank, Kopf in die Hand gestützt, Holzkrug mit Schaum, rote Wangen, Augen zu, seliges Grinsen, Brille schief im Haar |
| Porträt `logge` angetrunken | `portraits/logge-happy.png` | 256×256 | `teil-2.json` | Stimmungen sind feste Wörter (`MOODS` in `prompts.py` und `build_manifest.py`), daher ersetzt die angetrunkene Fassung (happy v3: rote Wangen und Nase, halb geschlossene glasige Augen, loses Grinsen, Kopf schief) das bisherige happy (breites Lachen, nicht angetrunken; liegt als `portrait-happy-rejected-2.png` bei den Rohbildern und kann per `promote logge portrait-happy-v2` + `build logge` zurückgeholt werden) |
| Manifest | `game/public/assets/manifest.json` | – | – | `build_manifest.py` und `--check` ohne Warnungen: 69 Figuren, 57 Porträt-IDs, 30 Hintergründe, 39 Tafeln, 82 Requisiten, 27 Symbole |

Anmerkungen:
- Die neue Pose `drunk-sit` steht nicht in `POSE_NAMES` von `build_manifest.py`; das Manifest löst sie über den Sidecar
  (`character`/`pose`) auf. Laufzeit: abspielbar unter ihrem eigenen Namen, ohne Fallback-Kette.
- Spielcode (`game/src/**`) wurde nicht angefasst. Wirtshausszene mit Logge, Sebastian und Pascal muss noch eingebaut werden.

## Status Blutlache (Nutzerwunsch 2026-10-08: Gewalt expliziter)

| Asset | Datei(en) | Größe | Provenienz | Fassung / Abweichungen |
| --- | --- | --- | --- | --- |
| Requisit `blutlache` | `props/blutlache.png` (+ `.json`) | 40×17, Höhe 16, Anker (21, 17), ohne Footprint | `docs/rebuild/art/props.json` (`props.py`, ein Codex-Auftrag) | v1. Frische dunkelrote Lache, flach am Boden, dunkler Kern, kleine Spritzer; ohne Boden, Figur, Waffe. Generischer Name, weil auch Kapitel I sie nutzt. Laufzeit über `chapters/common/blood.ts` (`bloodPool` zentriert und lässt sie per Tween wachsen) |

Anmerkungen:
- Blutspritzer sind kein Bild-Asset: `fx.burst(…, 'blood')` färbt die vorhandenen Wassertropfen-Partikel dunkelrot
  (`world/WorldScene.ts`).
- Die Tafel `e2-kontrolle` bleibt „kein Blut“: Sie zeigt den Moment vor dem Stich.

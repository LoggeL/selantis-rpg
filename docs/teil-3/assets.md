# Teil III „Falscher Glaube“: Assetbedarf und Herkunft

Alle neuen Bilder entstehen über die Codex-Pipeline (`scripts/art/`, `codex_image.sh`), Protokoll
`docs/rebuild/art/teil-3.json` (`record: teil-3` bzw. `--area=teil-3`). Figuren nur nach `docs/rebuild/art/refs/` und
DESIGN.md §3. Filmframes (`sources/frames/`) sind **nie** Bildreferenz. Türkis nur Urmacht und Valentus' Erscheinung,
Vamir kalt violett, Ignatius bernstein. **Keine Schrift im Bild.** Pro Lauf höchstens **ein** Codex-Job gleichzeitig
(`--jobs=1`), damit der Rechner nicht überlastet.

## Wiederverwendet

| Asset | Verwendung |
| --- | --- |
| `bg/e2-halle` | Vamirs Halle (Kugel, Plan, Weigerung, Kontaktmann) |
| `bg/k5-faehrte` | `e3-ghulwald` (Leichenfresser-Lager, Flick) |
| `bg/k3-leselager` | `e3-waldrast` (Lagerabend der Schwestern) |
| Tafel `e2-sehkugel` | Vamir findet Lia |
| Figuren `lia-cloak`, `e2-lia-stab`, `kyra`, `e2-kyra-gebannt`, `flick`, `e2-flick-gefangen`, `e2-ignatius`, `valentus`, `vamir`, `baris-scarred`, `paladin`, Dunkelschatten, `ghoul`, `villager-*`, `merchant` | wie gehabt |
| Porträts `e2-ignatius-*`, `kyra-*`, `e2-kyra-gebannt`, `flick-*`, `valentus-*`, `baris-scarred`, `paladin` | Dialoge |

## Neu: Kartenhintergründe

Drei-Viertel-Draufsicht wie die vorhandenen Karten, keine Personen, Figurengröße im Prompt (1/8 Bildhöhe bei
640×360, 1/16 bei 1280×720). Herbst, wo nicht anders gesagt.

| ID | Größe | Inhalt (Layout verbindlich, weil die Geometrie danach vermessen wird) |
| --- | --- | --- |
| `e3-lichtwald` | 1280×720 | Herbstwald. Ein Erdpfad tritt unten links ins Bild und windet sich nach rechts oben; in der rechten Bildhälfte eine runde moosige Lichtung mit einer alten Trauerweide (lange hängende Zweige wie ein Vorhang) in der Mitte oben, ein schmaler Bach am rechten Rand, ein zweiter Pfad verlässt das Bild am rechten Rand (Osten). Dichte Bäume oben und links. Weiches Morgenlicht, keine Leuchteffekte. |
| `e3-landstrasse` | 1280×720 | Herbstliche Landstraße von links nach rechts durch abgeerntete Stoppelfelder, Hecken, ein Meilenstein, eine kleine Brücke über einen Graben; oben rechts in der Ferne auf einem Hügel eine ummauerte Stadt mit Türmen (klein, Hintergrund). Nachmittag. |
| `e3-trapas` | 1280×720 | Inneres einer befestigten Stadt: unten Mitte das Innere eines großen Torbogens, von dort eine gepflasterte Straße nach oben auf einen kleinen Platz; links eine offene Schmiede mit Amboss und Esse, rechts Fachwerkhäuser; oben ein steinernes Ordenshaus mit breiter Treppe und Portal; blau-weiße Banner mit weißem Raubvogel (ohne Schrift) an den Häusern; Brunnen auf dem Platz. Tag. |
| `e3-ordenssaal` | 640×360 | Saal des Lichterordens: oben Mitte ein Podest mit hohem Stuhl, dahinter blau-weiße Banner mit weißem Vogel, ein langer Tisch links mit Kerzen und Papieren, Säulen, Steinboden mit Läufer, Tür unten Mitte. Kühl, fromm, wohlhabend. |
| `e3-gastzimmer` | 640×360 | Kleines Dachzimmer im Ordenshaus: Bett links mit Wolldecke, Fenster oben, Truhe, kleiner Tisch mit Kerze, Waschschüssel, Tür rechts, Holzboden, schräge Balken. |
| `e3-ordenshaus` | 1280×720 | Obergeschoss des Ordenshauses als Grundriss in Drei-Viertel-Ansicht: Flur in der Mitte; links eine Bibliothek mit Regalen und Lesepult; oben Mitte eine Waffenkammer hinter einem Eisengitter (Stäbe, Schwerter, Schilde an der Wand sichtbar); rechts oben die Tür zum Arbeitszimmer (schwere Tür); unten links zwei Zimmertüren; unten rechts eine Treppe nach unten; eine kleine Kapelle rechts mit buntem Fenster ohne Figuren; Wandleuchter. Neutral beleuchtet (Nacht wird per Licht gemacht). |
| `e3-keller` | 1280×720 | Links: Gewölbekeller mit Fässern, Kisten und einer runden, gemauerten Brunnenöffnung (Schacht) im Boden; Mitte und rechts: unterirdischer, gewölbter Wasserkanal mit knietiefem Wasser, gemauerten Rändern, der nach rechts führt und rechts in einem Bogen ins Freie mündet: Bachufer im Mondlicht mit Farn und Bäumen. Nacht, kalt. |
| `e3-falsches-lager` | 1280×720 | Waldlichtung mit einem notdürftigen Lager: ein Stück grobe Holzpalisade links, drei weiße Leinenzelte, Holzstapel, ein Wagenrad, eine Feuerstelle mit Steinkreis in der Mitte, ein einzelner Holzpfosten neben einem Zelt, rechts unter Bäumen ein hölzerner Käfigwagen. Pfad unten. Herbst, grau-trüber Vormittag. |
| `e3-innenwelt` | 640×360 | Traumlandschaft: eine kleine sonnige Sommerwiese mit einer Eiche und Kornblumen als Insel in der Mitte, ringsum wabernde violett-graue Wolken und Nebel, weiche Ränder, ruhig und unwirklich. |
| `e3-ritualhuegel` | 1280×720 | Kahle Hügelkuppe: in der Mitte ein langer grober flacher Felsblock (wie ein Altar, Kopfhöhe eines Knies), ringsum zehn leere hölzerne Ständer im Kreis, Fackelhalter, niedriges Gras; Waldränder links, unten und rechts; ein Pfad von unten links. Dämmerung. |
| `e3-waldpfad` | 1280×720 | Herbstlicher Waldweg von unten nach oben rechts, ein umgestürzter Baum quer am Rand, links eine moosige Böschung am Waldrand (Platz zum Liegen), Laub, Felsen. Später Nachmittag. |
| `e3-feldweg` | 1280×720 | Weites Herbstland am Morgen: ein Feldweg von unten links nach oben rechts zum Horizont, Wiesen und Stoppelfelder, ein einzelner Baum, Heuhaufen, ferne Hügel. Hell, ruhig. |

## Neu: Figuren

| ID | Basis | Inhalt | Posen | Porträts |
| --- | --- | --- | --- | --- |
| `e3-lia-eigenstab` | `lia-cloak` (wie `e2-lia-stab`) | Lia in Reisekleidung, Mantel über die Schultern zurückgeschlagen, trägt ihren **eigenen** Stab: lang, hell, fast weißes Holz, mit Spiralsegmenten und kantig geschnitzten Zeichen, oben eine schlanke Spirale; kein Edelstein, kein Metall; ruht neben ihr auf dem Boden | cast (türkises Licht an der Spitze), attack, sit, kneel, lie, hurt | – (Porträt `lia-cloak`) |
| `e3-lia-gefesselt` | `lia-cloak` | Lia ohne Stab, Hände vor dem Körper mit einem Strick gefesselt, Mantel zurückgeschlagen, staubig | sit, kneel, lie | – |
| `e3-lia-innen` | `lia` | Lia im inneren Raum: schlichtes langes weißes Spitzenkleid, Haar offen, barfuß | sit | – |
| `e3-ignatius-gefesselt` | `e2-ignatius` | Ignatius als Einsiedler, Hände vor dem Körper gefesselt | kneel | – |
| `e3-grossmeister` | neu | Großmeister des Lichterordens, etwa 55, aufrecht, kurzer grauer Bart, kurz geschorenes graues Haar, strenger Blick; cremefarbene Ärmel unter einem vertikal dunkelblau-weiß geteilten Überwurf mit kleinem weißem Vogelzeichen (ohne Schrift), breiter Gürtel, Siegelring, kein Helm | talk, sit | neutral, angry, thinking, grim, surprised, determined, ashamed |
| `e3-doktor` | neu | Gelehrter des Ordens, um 30, schmal, dunkles kurzes Haar, glatt rasiert, schwarze Robe, eng anliegende schwarze Haube mit zwei weißen Leinenbändern am Kinn, Gürtel mit Ledertaschen und einer Lupe | talk, interact, read | neutral, surprised, thinking, smirk |
| `e3-gestalt` | neu | Die Gestalt in Lias Innerem: junge Frau, eigener Entwurf, helles weiß-silbernes langes Haar, schlichtes weißes ärmelloses Kleid, barfuß, leicht durchscheinend wirkend, ruhige Miene | – | neutral, sad |

Zusätzliche Posen: `e2-ignatius` → lie, hurt.

## Neu: Tafeln (1280×720, `--chars` nur aus Referenzbögen)

| ID | Figuren | Inhalt |
| --- | --- | --- |
| `e3-erscheinung` | e2-lia-stab, valentus | Herbstwald am Morgen: Lia mit Schattentöter steht einer durchscheinenden, türkis leuchtenden Erscheinung des alten Magiers Valentus gegenüber, Lichtpunkte in der Luft |
| `e3-eigener-stab` | e3-lia-eigenstab, valentus | Unter den hängenden Zweigen einer alten Weide hält Lia staunend ihren neuen hellen Stab mit Spiralsegmenten, kleine türkise Lichter umkreisen sie, Valentus' Erscheinung verblasst im Hintergrund |
| `e3-paladine` | e2-ignatius, lia-cloak, paladin | Herbstliche Landstraße: zwei Paladine in weiß-silberner Rüstung mit weißem Wappenrock (blau-weißer Vogel) halten einen alten Mann in Rostrot und ein rotblondes Mädchen an, einer bindet dem Alten die Hände |
| `e3-trapas` | – | Blick auf die Stadtmauern und das Tor einer großen Festungsstadt am Nachmittag, blau-weiße Banner, Straße davor, keine Personen im Vordergrund |
| `e3-schutzreaktion` | e3-lia-gefesselt, e3-grossmeister, paladin, e2-ignatius | Ordenssaal: Lia kniet, türkises Licht bricht aus ihr in einer Druckwelle, Paladine taumeln zurück, Kerzen verlöschen, der Großmeister hebt den Arm vor die Augen, gefesselter Ignatius im Hintergrund |
| `e3-phiole` | kyra, lia-cloak | Nachts im kleinen Dachzimmer: Lia steht abgewandt am Fenster, im Vordergrund steckt Kyra (dunkle Kleidung) heimlich ein schmales Glasfläschchen in ihren Gürtel |
| `e3-schacht` | kyra, lia-cloak | Die Schwestern waten im Licht einer kleinen Laterne durch einen knietief überfluteten gemauerten Gewölbegang |
| `e3-gift` | kyra, lia-cloak | Kleines Lagerfeuer im Wald bei Nacht: Kyra reicht Lia einen Holzbecher, ein kaum sichtbarer violetter Schimmer über dem Becher, Lia lächelt müde |
| `e3-falle` | e3-lia-gefesselt, e2-kyra-gebannt, baris-scarred, vamir | Lager im Wald: zwei Schergen in schwarz-weißen Wappenröcken packen Lia an den Armen, Kyra steht abseits mit leerem Blick, Baris mit Augenbinde grinst, Vamir als schwarze Kapuzengestalt tritt aus violettem Rauch |
| `e3-gestalt` | e3-lia-innen, e3-gestalt | Violett-grauer Nebel: Lia im weißen Spitzenkleid, eine durchscheinende Frau in Weiß legt ihr die Hand auf die Schulter |
| `e3-relikte` | vamir, e3-doktor | Gewölbe im Kerzenlicht: auf einem langen Tisch zehn verschiedene alte, verhüllte und halb enthüllte Gegenstände (ein Horn, eine Schale, ein Stab, ein Reif, Steine …, nichts lesbar), der Doktor in schwarzer Robe zeigt in ein altes Buch, Vamir als Kapuzengestalt beugt sich darüber |
| `e3-ritual` | e3-lia-gefesselt, vamir | Hügelkuppe in der Dämmerung: Lia liegt gefesselt auf einem langen groben Stein, zehn hölzerne Ständer mit Gegenständen im Kreis, Vamir mit erhobenen Armen, vor ihm bildet sich eine türkise Lichtkugel, violette Ranken |
| `e3-stabrueckgabe` | flick, e3-lia-eigenstab, kyra | Nach dem Kampf am Stein: Flick reicht Lia den hellen Stab, Kyra steht erschöpft daneben (normale Augen), Rauch und Fackeln im Hintergrund |
| `e3-vamir-fall` | e3-lia-eigenstab, vamir, e2-ignatius | Waldweg: Lia richtet ihren Stab, ein türkiser Strahl trifft Vamir, der sich in violette Partikel auflöst; Ignatius liegt hinter ihr im Laub |
| `e3-abschied` | e2-ignatius, e3-lia-eigenstab | Am Waldrand im Herbstlaub: Ignatius liegt mit dem Kopf auf einer Böschung, Lia kniet neben ihm und hält seine Hand, warmes Abendlicht |
| `e3-hueterin` | e3-grossmeister, e3-lia-eigenstab, paladin | Platz vor dem Ordenshaus: Der Großmeister stellt Lia mit ihrem Stab einer Menge vor, Paladine mit blau-weißen Bannern |
| `e3-epilog` | e3-lia-eigenstab, kyra, flick, valentus | Feldweg im Herbstmorgen: drei junge Frauen gehen vom Betrachter weg in die Weite (Lia mit Stab, Kyra, Flick mit Bogen); im Vordergrund schaut ihnen eine durchscheinende türkise Erscheinung des alten Valentus nach |

## Neu: Itemsymbole

`e3-lia-staff` (heller Spiralstab), `e3-ordensfibel` (runde Fibel, weißer Vogel auf Blau) im Atlas `ui/items.png`.

## Status

(wird von der Asset-Lane gepflegt)

### Stufe A1: Kartenhintergründe (fertig)

Erzeugt mit `scripts/art/backgrounds.py bg <id> --area=teil-3` (ein Codex-Job zur Zeit), Protokoll
`docs/rebuild/art/teil-3.json` (verworfene Rohbilder als `…-rejected-N.png` mit Grund, übernommene Varianten mit
`promotedFrom`), Build-Einstellungen in `docs/rebuild/art/backgrounds.json`. Stilreferenzen: `selantis-map-hof` plus
`selantis-first-camp` (Wald/Nacht), `selantis-road-east` (Straße/Feld), `insel-bg-dorf` (Stadt), `bg/prolog-rat` (Innenräume).
Alle Rohbilder angesehen; keine Personen, keine lesbare Schrift, keine realen religiösen Symbole.

| Asset | Datei | Größe | Version | Urteil |
| --- | --- | --- | --- | --- |
| `bg/e3-lichtwald` | `game/public/assets/bg/e3-lichtwald.png` | 1280×720, 734 KB | v1 | fertig; Pfad unten links → Lichtung mit Trauerweide, Bach rechts, Ostpfad über Trittsteine |
| `bg/e3-landstrasse` | `game/public/assets/bg/e3-landstrasse.png` | 1280×720, 729 KB | v2 | fertig; v1 verworfen (stehendes Korn statt Stoppeln, Straße zu schmal) |
| `bg/e3-trapas` | `game/public/assets/bg/e3-trapas.png` | 1280×720, 726 KB | v2 | fertig; v1 verworfen (Platz zu eng, Stadtmauer mit Außenwald). Das Tor ist als Mauerfront von Süden gemalt (Torbogen unten Mitte, Durchgang begehbar, Mauerkrone braucht einen Verdecker) |
| `bg/e3-ordenssaal` | `game/public/assets/bg/e3-ordenssaal.png` | 640×360, 183 KB | v1 | fertig |
| `bg/e3-gastzimmer` | `game/public/assets/bg/e3-gastzimmer.png` | 640×360, 172 KB | v2 | fertig; v1 verworfen (christliches Kreuz an der Wand, Möbel zu groß) |
| `bg/e3-ordenshaus` | `game/public/assets/bg/e3-ordenshaus.png` | 1280×720, 620 KB | v2 | fertig; v1 verworfen (Kreuz auf dem Altar, Sternbanner statt weißem Vogel, Türen unklar). Neutral beleuchtet, Nacht per Licht |
| `bg/e3-keller` | `game/public/assets/bg/e3-keller.png` | 1280×720, 720 KB | v2 | fertig, nachts gemalt (`baked: 'night'`); v1 verworfen (halbes Bild schwarz, Kanal zu schmal) |
| `bg/e3-falsches-lager` | `game/public/assets/bg/e3-falsches-lager.png` | 1280×720, 730 KB | v1 | fertig; Pfosten mit Eisenschelle (für Flick), Käfigwagen unter Plane |
| `bg/e3-innenwelt` | `game/public/assets/bg/e3-innenwelt.png` | 640×360, 168 KB | v1 | fertig |
| `bg/e3-ritualhuegel` | `game/public/assets/bg/e3-ritualhuegel.png` | 1280×720, 635 KB | v3 | fertig; v1 (acht Ständer) und v2 (neun Ständer, Burg am Horizont) verworfen, v3 hat genau zehn |
| `bg/e3-waldpfad` | `game/public/assets/bg/e3-waldpfad.png` | 1280×720, 764 KB | v1 | fertig; Maßstab etwas näher als bei den anderen Karten (Weg ≈ 2,5 Figurenbreiten) |
| `bg/e3-feldweg` | `game/public/assets/bg/e3-feldweg.png` | 1280×720, 720 KB | v2 | fertig; v1 verworfen (flache Landschaftsperspektive, Dorf mit Kirchturm). Weg schmal, die Grasränder zwischen den Zäunen sind mitbegehbar |

**Hinweise für die Kartengeometrie** (Pixel im fertigen Bild):

- `e3-lichtwald`: Pfad tritt unten links ein (x 0–70, y 620–720) und steigt über (300, 520) bis (540, 330) zur
  Lichtung. Lichtung etwa Ellipse x 560–1060, y 240–500, offenes Gras reicht unten bis (520–850, 560). Trauerweide:
  Stamm (830, 205), Zweigvorhang x 620–1070, y 0–265 (Verdecker). Bach x 1040–1230 von oben nach unten, Trittsteine
  (1100–1200, 355), Ostpfad verlässt das Bild rechts bei (1280, 335–355). Bäume oben und links gesperrt.
- `e3-landstrasse`: Straße als Band von links nach rechts, y ≈ 335–425 (links) bis 345–415 (rechts), dazu Grasränder
  oben (y 315–340) und unten (y 425–460). Meilenstein (375, 322). Steinbrücke über den Graben x 840–985, y 315–430;
  Graben von (980, 120) nach (1060, 620). Stoppelfelder sind optisch begehbar, Hecken mit Steinmauern trennen sie. Ferne
  Stadt oben rechts (x 1080–1280, y 0–70), nicht begehbar.
- `e3-trapas`: Torbogen unten Mitte, Durchgang x 580–700, y 615–720 (Eingang). Mauerkrone mit Tortürmen y 520–720
  (Verdecker über dem Durchgang). Straße x 560–730 von y 600 hoch zum Platz. Platz offenes Pflaster etwa x 380–940,
  y 180–520, Brunnen Mitte (640, 290), Fuß x 540–750, y 255–355 (Hindernis). Ordenshaus oben: Treppe x 575–705,
  y 125–195, Portal (640, 90). Schmiede links: Esse (205, 320), Amboss (250, 390), Wassertrog (150, 420), Hof x
  100–420, y 330–440. Marktstand (360, 490). Fachwerkhäuser rechts ab x 870. Banner mit weißem Vogel an Laternenmasten
  (465, 220), (810, 220), (480, 400), (795, 400).
- `e3-ordenssaal`: Podest x 240–400, y 92–124, Hochstuhl (320, 75). Tisch links x 30–175, y 110–245 (Hindernis).
  Säulen am linken (x 0–30) und rechten Rand (x 610–640) sowie neben dem Podest (x 190–215 und 425–452, bis y 128).
  Freier Boden x 30–610, y 125–300. Läufer x 280–365 von der Tür bis zum Podest; Tür unten Mitte x 245–395, y 285–360,
  Durchgang x 278–365. Unten links/rechts Stufen nach unten (x 40–165 und 475–600, y 315–360).
- `e3-gastzimmer`: Bett links x 45–160, y 85–215, Truhe (55–120, 180–230). Fenster hinten Mitte x 270–340, y 0–75. Tisch
  mit Kerze x 350–415, y 75–125, Hocker (383, 118). Waschtisch x 443–500, y 75–145, Korb (495, 140). Tür in der
  rechten Wand x 560–605, y 105–260, Zugang bei (550, 220). Freier Holzboden x 60–580, y 125–350. Kisten/Krug unten
  links (0–90, 250–340), Kommode unten rechts (590–640, 240–350).
- `e3-ordenshaus`: Flur x 15–1195, y 355–475 (Läufer y 385–455). Bibliothek links x 20–390, y 30–260 mit Lesepult
  (200, 205); Durchgang Bibliothek↔Flur x 135–245, y 255–355. Waffenkammer oben Mitte hinter Gitter x 430–795, y
  170–255, Gittertor (605, 215), Stäbe/Schilde an der Rückwand x 520–700, y 50–140. Arbeitszimmertür (893, 200) in einer
  Nische x 820–970, y 100–275. Kapelle rechts x 1020–1270, y 30–360 mit buntem Fenster (1120, 110), Altar (1125, 205),
  Bänke (1045–1225, 265–345); Tür Flur↔Kapelle bei x 1010–1030, y 280–365. Flurende rechts Tür (1195, 380–460). Zwei
  Zimmertüren unten links (200, 580) und (345, 580) in einem Gang x 100–740, y 500–650. Treppe nach unten x 840–1025,
  y 545–690. Außenbereiche dunkel.
- `e3-keller`: Gewölbekeller links x 20–410, y 130–600 (Fässer an den Wänden), Brunnenschacht mit Steigeisen (205,
  315), Ring x 135–275, y 260–375. Treppe unten links (100–170, 560–640). Kanal (knietiefes Wasser, `shallow`) x
  415–1010, y 305–440, Mauersims oben (y 270–305) und unten (y 435–460). Rechts geht der Kanal bei x 1010–1040 offen ins
  Bachufer über; Ufer begehbar x 1040–1280, y 150–560 (Bach selbst x 1100–1280). Kleiner Abflussbogen (1045, 255).
  Unter dem Kanal (y 590–720, x 300–900) dunkle Leere, gesperrt.
- `e3-falsches-lager`: Lichtung etwa x 150–1150, y 190–560. Palisade links x 0–230, y 180–520. Zelte (420, 175),
  (785, 210), (330, 345) mit Holzstapel (245, 405) und Wagenrad (335, 410). Feuerstelle Mitte (625, 360), Bank (560,
  340), Holz (700, 340). Pfosten mit Schelle (927, 210). Käfigwagen unter Plane x 1000–1200, y 225–385. Pfad unten
  x 640–740, y 560–720 (Eingang). Bäume und Gebüsch an allen Rändern.
- `e3-innenwelt`: Wiese als Insel x 60–580, y 75–300, sicher begehbar x 110–520, y 110–280. Eiche Stamm (385, 110),
  Krone x 270–500, y 0–100. Ringsum Nebelwolken (gesperrt, weiche Ränder).
- `e3-ritualhuegel`: Hügelkuppe etwa x 300–1150, y 170–480. Steinblock Mitte x 545–750, y 278–325. Zehn Ständer im
  Ring: hinten (512, 205), (652, 198), (795, 212); links (395, 263), (380, 330); rechts (905, 268), (915, 330); vorne
  (487, 393), (645, 403), (807, 393). Fackelhalter (362, 155), (1030, 210), (202, 400), (1055, 480). Pfad von unten
  links (0–150, 620–720) über (300, 470) zur Kuppe. Wald links, unten, rechts; oben Ferne (gesperrt).
- `e3-waldpfad`: Pfad unten x 380–560 (y 720), steigt diagonal über (750, 420) bis oben rechts x 1150–1230 (y 0).
  Moosige Böschung links x 150–750, y 150–450 (Platz zum Liegen um (420, 330)). Umgestürzter Stamm rechts neben dem
  Pfad x 930–1130, y 285–520. Felsen (210, 225), (265, 420), (965, 115), (1140, 495). Bäume an den Rändern.
- `e3-feldweg`: Weg von unten links (0–120, 690–720) diagonal nach oben rechts (1190, 60), mit Grasstreifen zwischen
  den Zäunen (beidseitig ca. 40–60 px). Einzelner Baum (655, 260), Stamm (655, 345). Heuballen (122, 242), (523, 132),
  (1093, 303), (970, 588). Wiese links unten x 0–560, y 360–720 locker begehbar. Hügel oben (y 0–60) gesperrt.

### Stufe A2: Figuren (fertig)

Erzeugt mit `scripts/art/characters.py batch … --jobs=1 --area=teil-3` (ein Codex-Job zur Zeit), 45 Aufträge, alle im
ersten Versuch, Protokoll `docs/rebuild/art/teil-3.json` (Build-Daten unter `builds`; die neuen Posen von `e2-ignatius`
stehen dort als Rohbild-Provenienz, sein Build-Eintrag bleibt in `teil-2.json`). Einträge in `scripts/art/cast.json`
mit `"record": "teil-3"`, Posentexte in `POSE_EXTRA` (`scripts/art/prompts.py`, Abschnitt Teil III). Referenzen nur aus
`docs/rebuild/art/refs/` (Varianten über `base`, neue Figuren mit Stil-Anker `valentus` bzw. `lia`), keine Filmbilder.
Alle Rohbilder angesehen; kein Retry nötig. `qa.py walk` ohne Warnungen, Kontaktbögen unter
`output/imagegen/preview/art/<id>-contact.png` geprüft, `build_manifest.py --check` aktuell.

| Asset | Datei | Größe | Version | Urteil |
| --- | --- | --- | --- | --- |
| Bogen `e3-lia-eigenstab` | `docs/rebuild/art/refs/e3-lia-eigenstab.png` | Referenzbogen | v1 | fertig; heller, fast weißer Spiralstab mit kantigen Kerben und schlanker Spirale oben, kein Stein, kein Metall, kein Griffleder |
| `e3-lia-eigenstab` Laufblatt | `game/public/assets/sprites/e3-lia-eigenstab-walk.png` | 256×256, Höhe 41 | v1 | fertig |
| `e3-lia-eigenstab` Posen | `sprites/e3-lia-eigenstab-{cast,sit,kneel,hurt}.png`, `-attack.png`, `-lie.png` | 64×64, attack 96×64, lie 128×64 | v1 | fertig; cast = kleines türkises Licht an der Spitze, kontrolliert |
| Bogen `e3-lia-gefesselt` | `docs/rebuild/art/refs/e3-lia-gefesselt.png` | Referenzbogen | v1 | fertig; Strick vor dem Körper, staubig, ohne Stab und Tasche |
| `e3-lia-gefesselt` Laufblatt | `sprites/e3-lia-gefesselt-walk.png` | 256×256, Höhe 40 | v1 | fertig |
| `e3-lia-gefesselt` Posen | `sprites/e3-lia-gefesselt-{sit,kneel}.png`, `-lie.png` | 64×64, lie 128×64 | v1 | fertig |
| Bogen `e3-lia-innen` | `docs/rebuild/art/refs/e3-lia-innen.png` | Referenzbogen | v1 | fertig; weißes Spitzenkleid, Haar offen, barfuß (Kleid wadenlang, im Laufblatt etwas kürzer) |
| `e3-lia-innen` Laufblatt + Pose | `sprites/e3-lia-innen-walk.png`, `-sit.png` | 256×256 / 64×64, Höhe 40 | v1 | fertig; sit mit kleinem Grasbüschel unter dem Kleid |
| Bogen `e3-ignatius-gefesselt` | `docs/rebuild/art/refs/e3-ignatius-gefesselt.png` | Referenzbogen | v1 | fertig; wie `e2-ignatius`, Hände vorn gefesselt |
| `e3-ignatius-gefesselt` Laufblatt + Pose | `sprites/e3-ignatius-gefesselt-walk.png`, `-kneel.png` | 256×256 / 64×64, Höhe 43 | v1 | fertig |
| `e2-ignatius` neue Posen | `sprites/e2-ignatius-lie.png`, `-hurt.png` | 128×64 / 64×64 | v1 | fertig; lie: Rücken, Augen zu, Hände auf der Brust; hurt: Hände an der Brust, kein Blut. Die übrigen `e2-ignatius`-Sprites wurden dabei mit gemeinsamer Palette neu gebaut (gleiche Rohbilder) |
| Bogen `e3-grossmeister` | `docs/rebuild/art/refs/e3-grossmeister.png` | Referenzbogen | v1 | fertig; eigener Entwurf: kurzes graues Haar, kurzer Bart, Überwurf dunkelblau/weiß geteilt, weißer Vogel, cremefarbene Ärmel, Gürtel, Siegelring |
| `e3-grossmeister` Laufblatt + Posen | `sprites/e3-grossmeister-walk.png`, `-talk.png`, `-sit.png` | 256×256 / 64×64, Höhe 44 | v1 | fertig; sit = aufrecht **ohne gezeichneten Stuhl** (für den gemalten Hochstuhl in `e3-ordenssaal`) |
| `e3-grossmeister` Porträts | `game/public/assets/portraits/e3-grossmeister[-angry,-thinking,-grim,-surprised,-determined,-ashamed].png` | 256×256 | v1 | fertig; grim und neutral liegen nah beieinander |
| Bogen `e3-doktor` | `docs/rebuild/art/refs/e3-doktor.png` | Referenzbogen | v1 | fertig; eigener Entwurf: schwarze Robe, enge schwarze Haube mit zwei weißen Bändern, Ledertaschen, Lupe |
| `e3-doktor` Laufblatt + Posen | `sprites/e3-doktor-walk.png`, `-talk.png`, `-interact.png`, `-read.png` | 256×256 / 64×64, Höhe 43 | v1 | fertig; interact = Kristall durch die Lupe, read = altes Buch |
| `e3-doktor` Porträts | `portraits/e3-doktor[-surprised,-thinking,-smirk].png` | 256×256 | v1 | fertig |
| Bogen `e3-gestalt` | `docs/rebuild/art/refs/e3-gestalt.png` | Referenzbogen | v1 | fertig; eigener Entwurf: weiß-silbernes Haar, ärmelloses weißes Kleid, barfuß, kein Türkis. Deckend gemalt, Durchscheinen per Alpha im Spiel |
| `e3-gestalt` Laufblatt | `sprites/e3-gestalt-walk.png` | 256×256, Höhe 41 | v1 | fertig; sehr hell, auf dunklem Nebel gut lesbar |
| `e3-gestalt` Porträts | `portraits/e3-gestalt[-sad].png` | 256×256 | v1 | fertig; etwas weicherer Zeichenstil als die übrigen Porträts |

### Stufe A3: Tafeln und Itemsymbole (fertig)

Tafeln erzeugt mit `scripts/art/backgrounds.py plate <id> --chars=… --desc=… --area=teil-3` (ein Codex-Job zur Zeit),
Figuren ausschließlich über ihre Referenzbögen aus `docs/rebuild/art/refs/` (genau die `--chars` der Tabelle oben; alle
Bögen vorhanden, kein Ersatz nötig), keine Filmbilder, keine Fotos. Beschreibungen in `docs/rebuild/art/backgrounds.json`
(`builds["plate:<id>"]`), Prompts, Referenzen und Verwerfungsgründe in `docs/rebuild/art/teil-3.json` (verworfene Rohbilder
als `…-rejected-N.png`, übernommene Varianten mit `promotedFrom`). Die Tabelle „Neu: Tafeln“ hat **17** Einträge (nicht 16),
alle sind geliefert. Alle Rohbilder angesehen: Gesichter und Hände stimmig, keine Schrift, kein Blut; Lia rotblonde
Locken, Kyra nussbraun, Flick fast schwarzer Kurzhaarschnitt mit heller Strähne und spitzen Ohren, Vamir gesichtslos und
violett, Baris mit rotem Augenband über dem blinden rechten Auge, Türkis nur für Urmacht und Valentus.

| Asset | Datei | Größe | Version | Urteil |
| --- | --- | --- | --- | --- |
| Tafel `e3-erscheinung` | `game/public/assets/cut/e3-erscheinung.jpg` | 1280×720, 378 KB | v1 | fertig; Lia mit Schattentöter (Knotenstab mit Ledergriff), Valentus durchscheinend türkis. Kleine Burgsilhouette im Dunst rechts oben (nicht verboten, stört kaum) |
| Tafel `e3-eigener-stab` | `cut/e3-eigener-stab.jpg` | 1280×720, 396 KB | v1 | fertig; Trauerweide, heller Spiralstab wie im Bogen, Lichtpunkte, Valentus verblasst in Partikel |
| Tafel `e3-paladine` | `cut/e3-paladine.jpg` | 1280×720, 272 KB | v1 | fertig; zwei Paladine (blauer Vogel auf Weiß), einer bindet Ignatius, der andere hält Lia am Arm; Stadt klein am Horizont |
| Tafel `e3-trapas` | `cut/e3-trapas.jpg` | 1280×720, 280 KB | v1 | fertig; Torbau mit zwei Rundtürmen, blau-weiße Banner mit weißem Raubvogel, Straße mit Brücke, keine Personen im Vordergrund |
| Tafel `e3-schutzreaktion` | `cut/e3-schutzreaktion.jpg` | 1280×720, 366 KB | v1 | fertig; türkiser Ring um die kniende, gefesselte Lia, Paladine taumeln, Kerzen rauchen aus, Großmeister schirmt die Augen ab, Ignatius gefesselt rechts |
| Tafel `e3-phiole` | `cut/e3-phiole.jpg` | 1280×720, 360 KB | v1 | fertig; Kyra im grauen Umhang steckt das Fläschchen in den Gürtel, Lia abgewandt am Fenster (Rock hier grün statt braun, im Dunkel unauffällig) |
| Tafel `e3-schacht` | `cut/e3-schacht.jpg` | 1280×720, 342 KB | v1 | fertig; Kyra mit Laterne voraus, Lia friert, Wasser knie- bis oberschenkeltief |
| Tafel `e3-gift` | `cut/e3-gift.jpg` | 1280×720, 373 KB | v1 | fertig; Becher mit violettem Dampf (gut sichtbar statt kaum sichtbar, als Spielerhinweis brauchbar); ferne Burg mit Lichtern im Hintergrund (Trapas-Nähe plausibel) |
| Tafel `e3-falle` | `cut/e3-falle.jpg` | 1280×720, 367 KB | v1 | fertig; zwei Schergen schwarz-weiß, Kyra leer mit violettem Augenschimmer, Baris mit rotem Augenband und Axt, Vamir aus violettem Rauch |
| Tafel `e3-gestalt` | `cut/e3-gestalt.jpg` | 1280×720, 306 KB | v1 | fertig; violett-grauer Nebel, Lia im Spitzenkleid barfuß, durchscheinende Gestalt legt ihr die Hand auf die Schulter, kein Türkis |
| Tafel `e3-relikte` | `cut/e3-relikte.jpg` | 1280×720, 352 KB | v1 | fertig; zehn Gegenstände (Horn, Schale, Stab, Reif, drei Steine, Kästchen, Becher, Figur), Doktor zeigt auf ein Buch mit Kreisdiagramm (linke Seite nur unlesbare Striche), Vamir gesichtslos. Hinweis: Schädel im Regal links, Heiligenstatue in einer Nische rechts (generisch, keine reale Symbolik) |
| Tafel `e3-ritual` | `cut/e3-ritual.jpg` | 1280×720, 395 KB | v3 | fertig; genau zehn Ständer mit je einem Gegenstand, Lia gefesselt auf dem Stein, türkise Kugel über ihr, violette Ranken, nur Waldhügel. v1 verworfen (Burg am Horizont, Fragezeichen-artige Spirale in der Kugel), v2 verworfen (nur neun Ständer). Der Stein ist eher eine breite runde Platte als ein langer Block |
| Tafel `e3-stabrueckgabe` | `cut/e3-stabrueckgabe.jpg` | 1280×720, 363 KB | v2 | fertig; Flick reicht den hellen Stab, Kyra erschöpft mit normalen braunen Augen, Steinblock, umgestürzte Ständer, Fackeln, Rauch. v1 verworfen (Stadt mit Burg, fremdes rotes Banner mit Baum, kein Stein) |
| Tafel `e3-vamir-fall` | `cut/e3-vamir-fall.jpg` | 1280×720, 390 KB | v1 | fertig; türkiser Strahl aus der Spiralspitze, Vamir zerfällt in violette Partikel, Ignatius liegt im Laub; ferne Felsruine klein im Hintergrund |
| Tafel `e3-abschied` | `cut/e3-abschied.jpg` | 1280×720, 382 KB | v2 | fertig; Ignatius friedlich auf der Böschung, Lia hält weinend seine Hand, Stab im Laub wie im Bogen. v1 verworfen (Stadt, Burg, Brücke am See; Stab mit Ledergriff und Anhängern) |
| Tafel `e3-hueterin` | `cut/e3-hueterin.jpg` | 1280×720, 379 KB | v1 | fertig; Großmeister stellt Lia auf der Treppe vor, vier Paladine mit Bannern, Menge von hinten |
| Tafel `e3-epilog` | `cut/e3-epilog.jpg` | 1280×720, 282 KB | v1 | fertig; Kyra, Lia (Stab), Flick (Bogen) von hinten auf dem Feldweg, Valentus durchscheinend türkis im Vordergrund (blickt zum Betrachter statt den dreien nach, trägt eine Kapuze); keine Gebäude |
| Symbol `e3-lia-staff` | `game/public/assets/ui/items.png` (Einzelbild `docs/rebuild/art/icons/e3-lia-staff.png`) | 32×32 | v1 | fertig; heller Spiralstab diagonal, deutlich heller als `e2-schattentoeter` |
| Symbol `e3-ordensfibel` | `ui/items.png` (`docs/rebuild/art/icons/e3-ordensfibel.png`) | 32×32 | v1 | fertig; runde Fibel, Silberrand mit Nadel, weißer Raubvogel auf Dunkelblau |

Itemsymbole: `scripts/art/icons.py gen e3-icons --cols=2 --items=…` (Bogen `e3-icons` in `docs/rebuild/art/icons.json`,
Rohbild `output/imagegen/raw/art/icons/e3-icons.png`). `icons.py` protokolliert fest in `icons.json`; der Eintrag ist
zusätzlich in `teil-3.json` gespiegelt. Atlas jetzt 29 Symbole, die bisherigen 27 in unveränderter Reihenfolge, die beiden
neuen hinten angehängt (`ui/items.json`). `build_manifest.py` und `--check` aktuell (57 Tafeln, 29 Symbole).

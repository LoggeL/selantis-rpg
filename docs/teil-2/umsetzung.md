# Teil II „Letzte Hoffnung“: Umsetzung im Spiel

Verbindliche Szenenspezifikation für `game/src/chapters/teil-2/` (Kapitel-ID `teil-2`, `order: 6`, Karte
`numeral: 'Teil II'`, `title: 'Letzte Hoffnung'`). Grundlage: [Handoff](../handoff/teil-2/handoff.md),
[Szenenplan](../handoff/teil-2/story-plan.md), [Übergangsvertrag](../handoff/transition-contract.md),
[Quellenprüfung](quellenpruefung.md), [Adaptionsprotokoll](adaption.md), [Assets](assets.md).

## 1. Grundregeln für alle Szenen

- **Dialoge neu.** Kein Filmsatz wird übernommen, auch nicht leicht umgestellt. Filme liefern Ereignisse, Konflikte und
  Reihenfolge. Ton des Spiels: kurz, konkret, figurentypisch, höchstens ~140 Zeichen pro Box, Barks ~40.
  - **Lia**: belesen, trocken-ironisch, ängstlich und trotzdem widerborstig; sie denkt in Büchern; Schuldgefühle, weil
    alle, die ihr nahe sind, in Gefahr geraten. Sie ist keine Kriegerin.
  - **Kyra**: zupackend, schlagfertig, beißt (wörtlich und im Wortsinn), kann nicht lesen, steht bedingungslos zu Lia.
  - **Flick**: Spott als Rüstung, Fährtenleserin, Halbelfe, nennt Lia „Leseratte“; Einsamkeit nur in leisen Momenten.
  - **Elnon**: kühl, knapp, Verantwortung für viele; sein Vorurteil gegen Flicks verschwiegene Herkunft ist konkret
    (sie hat gelogen, als sie aufgenommen wurde), später ehrliche Entschuldigung ohne Romanze.
  - **Foltan**: pragmatisch, belehrend, schämt sich, kann schlecht um Verzeihung bitten. **Azar**: herzlich, Sprichwörter,
    kocht, schreckhaft. **Alastir**: still, ernst, Elf mit Brandnarbe.
  - **Ignatius**: alter Gelehrter, warm, mit leisem Humor, spricht in Bildern, verschweigt aus Vorsicht, unterscheidet
    ausdrücklich zwischen Wissen, Deutung und Vision. Kein Schurke, kein Allwissender.
  - **Vamir** (bis `e2-ignatius` Sprecher `vamir` = „Der Meister“, danach `e2-vamir` = „Vamir“): leise, gelangweilt,
    grausam aus Kalkül; Gesicht bleibt im Schatten der Kapuze. Seine Besitzansprüche sind Behauptungen.
  - **Baris** (`e2-baris`, Porträt `baris-scarred`): verbrannt, gedemütigt, gefährlich; Hauptmann. Orwen nicht nötig.
- **Wissen trennen.** Lia erlebt Lehrerwald und Sorge; Gefangenenszenen sieht nur der Spieler. Lia erwähnt danach nichts
  aus ihnen, außer als ausdrücklich gekennzeichnete Albträume, die Ignatius als ungewiss einordnet.
- **Gewalt und Kontrolle** nur über Kamera, Posen, Licht, Ton, Schnitt, Abblenden. Keine Verstümmelung, kein Blut im Bild,
  keine Folter als Belohnungsspiel. Keine Todesbestätigung für Elnon.
- **Neutrale Begriffe:** „die Prüfung“, „der Druide“ (siehe Quellenprüfung), unbenannte Stadt, unbenannte Frau in Flicks
  Erinnerung, Vamirs früherer Name wird nicht genannt. Gwynn wird nur als Bericht erwähnt. Zeitangabe: „sechzehn Jahre“
  bzw. „seit Dunkelhain“.
- **Türkis** nur Urmacht (`~…~`-Markup, `fx 'urmacht'`, Licht `urmacht`), Vamir violett `0x9a6cff`, Ignatius bernstein.
- **Text**: Deutsch mit Umlauten und „…“; „Elf/Elfe/Elfen“, nie „Elbe“; „Halbelfe“ ist Flicks Selbstbezeichnung im
  Spiel (Design-Sprachregel verbietet nur „Elbe/Halbelbe“).

## 2. Technik, Zustand und Übergänge

- Jede Szene ist ein Modul `teil-2/<szene>.ts` und exportiert `export const scene: SceneEntry` (id, title, prepare,
  start). `index.ts` verdrahtet die Reihenfolge; `nextScene` folgt ihr.
- `prepare()` ruft immer zuerst `prepareE2('<id>')` aus `shared.ts` (dokumentierter Standardzustand für Kapitelwahl,
  F2 und `?scene=`), danach eigene Ergänzungen. `prepare` wird nur von `G.warp` aufgerufen.
- Normale Übergänge ausschließlich `await G.goto('<nächste>')` (speichert, kein Reset). Kein `G.warp` im Spielfluss.
- Fortschritt nur in `G.state`. Einmalige Gaben, Fähigkeiten und Siege mit eigenem Flag schützen (`grantOnce`).
- Jede Szene startet bei einem Reload neu: Das Skript muss aus dem gespeicherten Szenenstart einen gültigen Einstieg
  machen. Abschluss-Flags erst am Szenenende setzen, unmittelbar vor `G.goto`.
- Karten-IDs mit `e2-`; jede Szene, die einen Ort mit anderer Zeit/Situation erneut nutzt, bekommt eine eigene Karten-ID
  oder `resetOnEnter: true`, damit das Kartengedächtnis passt.
- Gruppe: bis zum Lagerangriff `G.state.setParty(['flick', 'kyra'])` und `companions` passend; ab dem Ende von
  `e2-lagerangriff` `setParty([])`. Gefangenenszenen starten die Welt mit `player: 'e2-flick-gefangen'` bzw. Kyra/Elnon,
  ohne `G.state.party` zu ändern, und beginnen mit einer sichtbaren Rahmung („Unterdessen …“, `interlude()`).
- Lias Aussehen: `lia-cloak`; ab Erhalt von Schattentöter `e2-lia-stab` (`liaLook()`).
- Lichtstoß: Beim ersten Betreten von Teil II wird `e2-lichtstoss-vorher` (true/false) festgehalten. `e2-konzentration`
  lehrt `lichtstoss` nur, wenn Lia ihn noch nicht kennt; sonst wird die vorhandene Fähigkeit als „Instinkt, jetzt
  Kontrolle“ angesprochen. Nichts wird verlernt.
- Neue Kampffähigkeit `e2-stabimpuls` (Spieldesign, dokumentiert im Adaptionsprotokoll): nur mit Schattentöter im
  Kampf verfügbar, ab `e2-stabtraining`.

### Vertragsflags

`e2-staff-received` (+ Item `e2-schattentoeter`), `e2-training-complete`, `e2-flick-escaped`, `e2-kyra-controlled`,
`e2-elnon-struck`, `e2-finished`. Abschluss: Credits „Ende des zweiten Buches“, danach — da `e3-valentus` noch nicht
existiert — zurück zum Titel (`finishBook2()` in `chapters/common/bookContract.ts` wählt `G.goto('e3-valentus')`,
sobald die Szene registriert ist).

### Zustandsfahrplan (`prepareE2` kumuliert alles vor der Zielszene)

| Szene | setzt am Ende |
| --- | --- |
| e2-taverne | `e2-taverne-done`, Hinweis `e2-spur-zugang` |
| e2-bruderschaft | `e2-angekommen`, `e2-foltan-haltung` = `'kalt' \| 'offen'` |
| e2-pruefung | `e2-pruefung-done`, Wissen `e2-lore-pruefung` |
| e2-flicks-herkunft | `e2-flick-zugehoerig` |
| e2-lagerangriff | `e2-getrennt`, `setParty([])` |
| e2-der-fremde | `e2-fremder-done` |
| e2-gefangene | `e2-gefangene-done`, `e2-flick-sah-ring` |
| e2-urmacht | `e2-urmacht-erklaert`, Wissen `e2-lore-xenovia`, `e2-lore-valentus` |
| e2-flicks-verhoer | `e2-verhoer-done`, `e2-flick-nagel` |
| e2-konzentration | `e2-konzentration-done` (+ `lichtstoss`, falls neu) |
| e2-flicks-erinnerungen | `e2-erinnerungen-done` |
| e2-kyras-widerstand | `e2-kyra-widerstand-done` |
| e2-ignatius | `e2-ignatius-vorgestellt`, `e2-staff-received`, Item `e2-schattentoeter`, Wissen `e2-lore-rat`, `e2-lore-vamir` |
| e2-zellengespraeche | `e2-versoehnt` |
| e2-stabtraining | `e2-training-complete`, Fähigkeit `e2-stabimpuls` |
| e2-flick-entkommt | `e2-flick-escaped` |
| e2-kontrolle | `e2-kyra-controlled`, `e2-elnon-struck` |
| e2-aufbruch | `e2-finished` |

## 3. Szenen

Jede Szene nennt Ort, Herzstück, Pflichtbeats, Ziele und Übergang. Freie Formulierungen der Dialoge sind ausdrücklich
erwünscht; die Beats sind verbindlich.

### e2-taverne – „Rast im Goldenen Eber“ (F2 01:30–03:10)
- **Ort:** `e2-eber` (Hintergrund `k3-eber`, Geometrie von `eberMap` übernehmen), früher Abend, Musik `tavern`.
  Adaption: begründete Rückkehr, weil der Eber auf dem Weg liegt und Craupor Foltan verpflichtet ist.
- **Start:** Kapitelkarte `Teil II · Letzte Hoffnung · Zurück zu den Rebellen`. `e2-lichtstoss-vorher` festhalten.
- **Herzstück:** Hinweise zum heutigen Zugang des Lagers sammeln und kombinieren. Lia kennt den Weg nicht: Sie wurde mit
  verbundenen Augen hineingeführt (Kapitel IV). Drei Quellen (Craupor, den Flick ausfragt: das Lager liege nah, der genaue Ort sei unbekannt, Posten stünden weiter draußen;
  ein Fallensteller/Jäger: frische Zeichen in der Rinde am Bachlauf nördlich; die Schankmaid: Mehlsäcke gehen
  morgens Richtung Norden an der umgestürzten Eiche vorbei). Danach am Tisch die Route wählen (`choose` mit Tags der
  Funde); falsche Wahl korrigiert Flick ohne Strafe. Hinweis `e2-spur-zugang`.
- **Pflichtbeats:** Lia ist müde, Blasen an den Füßen; empfindet die Kraft als Last und Ursache der Verfolgung. Kyra und
  Flick geben Halt (Kyra: Abenteuer, Flick: trocken). Lia wünscht sich nur, dass es vorbei ist. Kyra reagiert auf den
  Stall, in dem sie angekettet war (optional, Interaktion an der Stalltür). Lia denkt an Foltan.
- Optional: Craupor erkennt Lia („Foltans Begleiterin“) und gibt einmalig Proviant (`grantOnce('e2-proviant', …)`).
- **Ausgang:** Tür → `G.goto('e2-bruderschaft')`.

### e2-bruderschaft – „Die Bruderschaft“ (F2 03:17–04:56)
- **Teil 1:** `e2-waldposten` (Hintergrund `k4-waldpfad`), Tag. Spurenblick: Zeichen in der Rinde, Wegmarken. Lia fällt
  zurück (Barks), Kyra und Flick laufen voraus. Am Bachübergang Hinterhalt: Rebellen mit Bögen; Tableau, Abblende,
  die drei sind an Bäume gebunden (Kyra/Flick-Posen, Lia `kneel`).
- Elnon erkennt Flick, stellt ihre verschwiegene Herkunft gegen sie (konkret: sie hat beim Eintritt gelogen); er erkennt
  auch Lia als das Mädchen, das in der Nacht seines Gesprächs mit Foltan verschwand. Lia redet (Auswahl, trockener
  Humor) und erreicht, dass man sie losbindet.
- **Teil 2:** `e2-lager-tag` (Geometrie `campBase` aus Kapitel IV). Rückkehr ins bekannte Lager, keine neue Vorstellung.
  Azar stürmt herbei (herzlich, erleichtert, Sprichwort). **Foltan**: Pflichtgespräch mit Auswahl; Lia kann kalt bleiben
  oder ihn anhören; beides führt zu keinem vollständigen Vertrauensabschluss (`e2-foltan-haltung`). Kyra trifft Foltan
  (sie weiß inzwischen, wer er ist). Alastir optional. Ziel danach: in Elnons Zelt → `G.goto('e2-pruefung')`.

### e2-pruefung – „Die Prüfung“ (F2 05:01–09:05)
- **Ort:** `e2-lager-abend` (Dämmerung, Feuer), Szene vor Elnons Zelt.
- **Beats:** Flick berichtet Elnon (Quellenprüfung §8: der Bericht ist Flicks), Kyra platzt begeistert dazwischen (Lia schwebte, schimmerte, schleuderte den Hauptmann fort). Lia
  erinnert sich kaum. Elnon: Nach Dunkelhain stehen kaum noch Zauberkundige auf der Seite der Freien; die wenigen dienen
  Fürsten. Er ordnet die Prüfung an: Der Druide gibt ihr einen Trank, der nur jemandem mit echter Kraft nichts anhaben
  soll; den Rest lässt er unausgesprochen. Kyra („meine Schwester“) und Flick protestieren, Flick bietet Flucht an.
- **Herzstück:** Lias Entscheidung (Auswahl: alle Wege führen dazu, dass sie es selbst will) → `storyAction('lift',
  'Die Schale an die Lippen heben')` → die Urmacht reißt aus ihr heraus: Lia versucht, sich festzuhalten (`G.ui.hold`
  mit `struggle`, scheitert nicht endgültig) → Tafel `e2-pruefung` (Rebellen halten sie, türkis) → Zusammenbruch.
- **Schnitt** (Gegner, Rahmung „Weit entfernt …“): Tafel `e2-sehkugel`, Sprecher `vamir` („Der Meister“) bemerkt das Licht
  und lässt Baris rufen. Regeln der Kugel bleiben unbekannt.
- Danach: Der Druide: schwach, aber am Leben; Kräfte wie aus den alten Geschichten der Zehn. Er nennt Ignatius von Ignis
  als einzigen, der helfen könnte, verschwunden seit Dunkelhain; will bis morgen nachdenken. Wissen `e2-lore-pruefung`.
  → `G.goto('e2-flicks-herkunft')`.

### e2-flicks-herkunft – „Halb und halb“ (F2 09:19–10:25)
- **Ort:** `e2-lager-nacht` (Nacht, Feuer, Glühwürmchen). Lia erwacht im Zelt, erschöpft (langsames Gehen).
- **Herzstück:** freies Nachtlager: Kyra erzählt, was Lia getan hat (Fesseln gesprengt, Männer geschleudert); optional
  Azar am Kessel (Erinnerung/Essen), Foltan an der Palisade (zweite Chance, abhängig von `e2-foltan-haltung`), der Druide
  (Wissen über die Prüfung, neutral), Alastir. Pflicht: Flick auf dem Wehrgang/an der Palisade finden.
- **Pflichtbeat:** Flick erklärt die Halbherkunft, die Lüge beim Eintritt, Ablehnung durch Menschen und Elfen. Lia fragt
  nach Einsamkeit. Lia bestätigt die Zugehörigkeit (Auswahl mit drei Tonlagen, alle bejahend). `e2-flick-zugehoerig`.
  Keine numerische Misstrauensstrafe.
- Schlafen im Zelt → `G.goto('e2-lagerangriff')`.

### e2-lagerangriff – „Überfall im Morgengrauen“ (F2 10:58–12:14)
- **Quellenbefund** (quellenpruefung.md §4): Das Lager wird nicht niedergebrannt, es gibt kein Massaker. Flick fordert
  die Schwestern wahrscheinlich zum Verstecken auf und bleibt selbst zurück; Kyra drängt Lia im Wald zur Flucht und wird
  dabei gefasst; Flick, Elnon und mindestens ein weiterer Rebell werden gefangen; eine reglose Person ohne bestätigten Tod.
- **Auftakt:** eigene Karte `e2-lager-alarm` (campBase, Morgengrauen/Nacht, Fackeln, kein Brand), Alarm am Tor,
  Elnon und die Torwachen laufen hin; Flick schickt Lia und Kyra fort und greift nach Bogen und Messer.
- **Taktikkampf `e2-ueberfall`:** Lia (erschöpft: halbe LP, keine Urmacht) und Kyra müssen vom Lagerplatz zum hinteren
  Bachdurchlass (reach mit `unit: 'lia'`); Flick, Elnon, Foltan und Azar halten Dunkelschatten auf (alle `nonLethal`);
  Gegner in Wellen, Baris (vernarbt, `nonLethal`) erscheint am Tor. Niederlage nur, wenn Lia fällt. Ein Sieg verhindert
  die Trennung nicht.
- **Nach dem Kampf (Welt `e2-bach-flucht`, Hintergrund `k4-bach`):** Kyra ist umgeknickt/erschöpft, sie drängt Lia
  weiterzulaufen und bleibt zurück, um die Verfolger abzulenken; Lia will bleiben (Auswahl), Kyra besteht darauf
  (Lia läuft). Tafel `e2-trennung` aus Spielersicht: Kyra wird gefasst („wieder die Falsche“ in eigenen Worten), Baris
  erkennt Flick, die mit Elnon gefesselt an der Palisade sitzt. Lia bricht im Wald zusammen, Schritte, Schwarz.
- **Verbleib:** Foltan und Azar halten das Tor und ziehen sich mit Alastir und den meisten Rebellen nach Süden zurück
  (Adaption). Lia weiß das nicht. `setParty([])`, `e2-getrennt` → `G.goto('e2-der-fremde')`.

### e2-der-fremde – „Der Fremde“ (F2 12:25–13:35)
- **Ort:** `e2-ignatius-lager` (neu), Dämmerung. Sprecher `e2-fremder` (Name „Der Fremde“, Porträt `e2-ignatius`).
- **Herzstück (begrenzte Handlungsmacht):** `storyAction('open-eyes')`, Lia liegt; sie steht taumelnd auf (langsame
  Bewegung), will zum Pfad; der Fremde redet ruhig; ein Becher (`storyAction('lift')`). Versucht sie zu gehen, knicken
  die Knie ein (höchstens zwei Versuche). Fragen: wer er ist, wo Kyra und Flick sind – er weicht aus („später“),
  spricht von einer größeren Sache. Er versetzt sie mit einer bernsteinfarbenen Geste wieder in Schlaf.
- Keine Heilmagie als Erklärung des Erwachens. → `G.goto('e2-gefangene')`.

### e2-gefangene – „Köder“ (F2 13:43–16:07) — Gefangenenblick
- **Rahmung:** `interlude('Unterdessen, in den Gewölben des Meisters …')`. Spieler: Flick (`e2-flick-gefangen`), an
  einen Ring gekettet (kleiner begehbarer Kreis in `e2-halle`).
- **Herzstück:** In Reichweite der Kette beobachten: Wachen und Schlüssel, Elnon (gefesselt, `e2-elnon-gefangen`),
  der lose Ring im Boden (`e2-flick-sah-ring`), die Tür zu den Zellen. Danach Auftritt: Baris wird für Lias Flucht
  getadelt; er präsentiert Flick, Kyra (weggesperrt) und Elnon als Köder. Elnon provoziert, wird abgeführt. Flick
  verteidigt ihn (Auswahl der Antworten, alle trotzig). Vamir: Lia trage etwas, das ihm gehöre (seine Behauptung);
  er kündigt Mittel an. Baris meldet nebenbei, die meisten Rebellen seien nach Süden entkommen (Spielerwissen).
- → `G.goto('e2-urmacht')`.

### e2-urmacht – „Was Valentus tat“ (F2 16:19–18:37)
- **Ort:** `e2-ignatius-lager`, Tag. Der Fremde zeichnet mit Kohle auf Birkenrinde (Tafeln `e2-bericht-xenovia`,
  `e2-bericht-wiege`, Bildunterschrift „Nach der Erzählung des Fremden“).
- **Herzstück:** Fragebaum (alle Pflichtfragen stellen: Freunde, Urmacht, „Was hat das mit mir zu tun?“; optional:
  „Wer seid Ihr?“ – weicht noch aus). Lias Vorwissen: Sie ergänzt die Xenovia-Geschichte selbst (Auswahl; korrekt:
  Meeresgrund, Verbannungsfest, Kettengebäck; Tags bei passenden Wissenseinträgen oder Gegenständen aus Buch 1).
  Enthüllung: Valentus, Bauernpaar, Säugling. Lia: die Eltern, Kyra – alles wegen ihr; sie will die Macht hergeben.
  Er hält dagegen und bietet Unterricht an. Wissen `e2-lore-xenovia`, `e2-lore-valentus`.
- → `G.goto('e2-flicks-verhoer')`.

### e2-flicks-verhoer – „Standhaft“ (F2 19:07–20:41) — Gefangenenblick
- **Ort:** `e2-halle`, Flick auf dem Verhörstuhl (`sit-chair`).
- **Herzstück:** Während der Meister spricht, lockert Flick heimlich einen Nagel aus der Armlehne
  (`storyAction('reach', 'Den losen Nagel lockern')`, nur wenn niemand hinsieht – Kamera/Bark-Hinweise). Ergebnis
  `e2-flick-nagel`: Damit kann sie später eine Handschelle heimlich lösen (Adaption; der Film zeigt nur ein Handgemenge
  und einen Schlüsselbund). Antworten als trotzige Auswahl. Drohung gegen ihre Ohren bleibt Drohung. Die Folter
  an den Fingern: Kamera auf Baris' Schatten, Schnitt, Ton, Abblende; keine dauerhafte Verletzung benennen.
- → `G.goto('e2-konzentration')`.

### e2-konzentration – „Atem“ (F2 20:50–21:38)
- **Ort:** `e2-ignatius-lager` (Übungsplatz). Lia zweifelt (Freunde leiden), der Fremde verlangt Sammlung.
- **Herzstück:** DOM-Minispiel `Sammlung` (eigene Logik mit Vitest): Ein Licht in der Mitte, Atemring; Gedanken
  („Kyra“, „Flick“, „der Hof“, „Foltan“) treiben heran und ziehen das Licht weg; Lia lässt sie vorbeiziehen (nicht
  anklicken), hält das Licht mit Richtungseingabe in der Mitte und bestätigt beim vollen Atem. Drei ruhige Atemzüge =
  Impuls. Fehlschlag kostet nur Zeit. Tastatur, Maus und Touch.
- Ohne Lichtstoß: erster bewusster Impuls → `learn('lichtstoss')` (einmal). Mit Lichtstoß: Er erkennt den Reiseimpuls
  als Instinkt; die Übung ist Kontrolle. → `G.goto('e2-flicks-erinnerungen')`.

### e2-flicks-erinnerungen – „Fremde Hände im Kopf“ (F2 22:05–24:08) — Gefangenenblick
- **Ort:** `e2-halle`. Vamir dringt in Flicks Erinnerungen (violett). Tafel `e2-erinnerung` mit sichtbarer Rahmung.
- **Herzstück:** `stealthGame('cover', 'Die Erinnerung verschließen')` als innerer Widerstand (Fehler wiederholen nur
  den Abschnitt, kein Scheitern, keine Belohnung). Die Frau bleibt unbenannt; Flick verlangt, dass er ihren Kopf
  verlässt, und verrät nichts. → `G.goto('e2-kyras-widerstand')`.

### e2-kyras-widerstand – „Nicht ein Wort“ (F2 24:14–25:19) — Gefangenenblick
- **Ort:** `e2-halle`, Kyra gefesselt auf dem Holztisch (`kyra-bound` `lie`).
- **Herzstück:** Spieler als Kyra: Antworten (Auswahl, alle Weigerung, Kyra-Humor) und ein kleiner Widerstandsmoment:
  Kyra tastet nach dem Knoten (`storyAction('tend')`), wird bemerkt – die Gefangenschaft bleibt. Vamir sagt, er könne
  Lia gerade nicht aufspüren, etwas schütze sie (unbenannt). Kyra triumphiert innerlich. Abblende vor seiner Berührung.
- → `G.goto('e2-ignatius')`.

### e2-ignatius – „Ignatius von Ignis“ (F2 25:49–29:58)
- **Ort:** `e2-ignatius-lager`, Nacht → Morgen → Nacht.
- **Albtraum (gerahmt):** violett verzerrte Bilder, Stimmen von Kyra und Flick, ausdrücklich Traum. Lia erwacht.
- **Gespräch:** Er stellt sich vor (Sprecher wechselt zu `ignatius`): Rat der Zehn Geweihten, Ignis, Gesetze und
  Wächteramt, Dunkelhain; nur Valentus und er überlebten von den Treuen – und eine dritte Geweihte, Gwynn, die die
  Abtrünnigen gefangen halten (Bericht, Ort unbekannt); Rückzug in die Wälder; er spürte die Urmacht nach sechzehn
  Jahren wieder, als die Prüfung sie weckte. Einer der Abtrünnigen beseitigte die anderen und nennt sich Vamir, „der
  Allmächtige“ in der alten Sprache; er braucht die Trägerin. Traum: vielleicht wahr, vielleicht Vamirs Werk – er weiß
  es nicht. Wissen `e2-lore-rat`, `e2-lore-vamir`. Ab hier Sprecher `e2-vamir`.
- **Objektübergabe (Morgen):** Tafel `e2-schattentoeter`, `storyAction('reach', 'Den Stab nehmen')`, `grantOnce`:
  Item `e2-schattentoeter`, Flag `e2-staff-received`. Lia sieht jetzt `e2-lia-stab`.
- **Nachtweg (Herzstück):** Lia kann nicht schlafen, Ignatius ist fort. Spurenblick: seine Fußspuren, ein verlorener
  Holzscheit, geknickte Zweige zum Bach. Sie findet ihn beim Holzsammeln (Alltagshumor, kein Unfähigkeitsbeweis), trägt
  Holz mit zurück. → `G.goto('e2-zellengespraeche')`.

### e2-zellengespraeche – „Durch die Gitter“ (F2 30:17–32:10) — Gefangenenblick
- **Ort:** `e2-kerker`. Spieler: Flick in ihrer Zelle.
- **Beats:** Zwei Wärter schlagen Elnon (nur Ton/Schatten/Abblende), er provoziert sie. Flick fragt nach ihm; beide
  verletzt; Kyra ist beim Meister. Elnon entschuldigt sich für den Umgang mit ihrer Herkunft; Flick erklärt die Lüge
  (Auswahl: wie viel sie sagt). Keine Romanze. `e2-versoehnt`. Kyra wird halluzinierend zurückgebracht.
- **Herzstück:** In der Zelle: mit dem Nagel (`e2-flick-nagel`) das Schloss der Handschelle lösen und die Schelle so
  angelegt lassen, dass niemand es sieht (`storyAction('tend')`); Wärterroutine beobachten (wer trägt den Schlüsselbund,
  wann sind sie zu zweit).
- → `G.goto('e2-stabtraining')`.

### e2-stabtraining – „Schattentöter“ (F2 32:20–33:38)
- **Ort:** `e2-ignatius-lager`, Tag. Spieler `e2-lia-stab`.
- **Herzstück 1:** Zielübung auf dem Übungsplatz: markierte Stümpfe/hängende Holzscheiben mit dem Stab treffen
  (Interaktion „Stabimpuls“), dabei das Vogelnest, Ignatius' Laterne und den Wasserkrug nicht treffen – Entscheidung vor
  Kraft. Fehltreffer: nur Kommentar und Neuversuch.
- **Herzstück 2:** Kleiner Taktikkampf `e2-uebungskampf`: zwei Leichenfresser am Bach; Lia mit Schattentöter
  (`e2-stabimpuls`, `lichtstoss`, `ausweichen`, `ablenken`), Ignatius als nichttödlicher Begleiter, der nur deckt.
  Sieg einmal belohnt (`e2-uebungskampf-gewonnen`, Fortschrittsbudget). Niederlage: Erneut versuchen.
- **Beats:** Lia lernt schnell; sie fühlt sich bereit, ihre Freunde zu holen; er vermisst Besonnenheit und gesteht ein
  eigenes Versagen ohne Details. `learn('e2-stabimpuls')`, `e2-training-complete`. → `G.goto('e2-flick-entkommt')`.

### e2-flick-entkommt – „Ein Nagel und ein Schlüsselbund“ (F2 33:44–35:16) — Gefangenenblick
- **Ort:** `e2-kerker`. Kyra leidet unter Visionen; Flick und Elnon sprechen leise: Sie wissen selbst nicht, wo Lia ist,
  und gewinnen ihr Zeit. Zwei Wärter holen Flick ab.
- **Herzstück:** Im Gang schlägt Flick mit der gelösten Hand zu (Quellenbefund §6: Handgemenge, Schlüsselbund am Boden;
  kein Zauber): kurzer Reaktionsmoment (`storyAction` oder Auswahl mit Zeitdruck, Fehler wiederholen nur den Moment),
  der Schlüsselbund fällt. Sie läuft zur Zelle von Elnon und Kyra; Elnon entscheidet bewusst, bei Kyra zu bleiben, und
  schickt sie, Hilfe zu holen. Danach Schleichweg am zweiten, alarmierten Wärter bzw. einer Patrouille vorbei zum
  Ausgang (Wachen mit Sichtkegeln, Verstecke im Schatten, Checkpoint, kein Game Over). Tafel `e2-flucht`.
  `e2-flick-escaped`. → `G.goto('e2-kontrolle')`.

### e2-kontrolle – „Das neue Spielzeug“ (F2 35:35–38:08) — Gefangenenblick
- **Ort:** `e2-halle`. Vamir tobt über Flicks Flucht (Wachen, Baris). Er wählt Kyra als schwächsten Geist.
- **Herzstück (ohne Rettungszweig):** Spieler als Elnon (gefesselt): Er versucht, Kyra zu erreichen (Auswahl: ihren
  Namen rufen, an Lia erinnern, an den Hof erinnern); jede Antwort prallt an der Kontrolle ab. Kyra spricht mit fremder
  Ruhe, nennt Vamir „Meister“. Schwert, Befehl, Tafel `e2-kontrolle`, Stoß im Schnitt (Ton, Licht, Abblende), Elnon
  fällt. Vamir: neues Lieblingsspielzeug (eigene Worte). `e2-kyra-controlled`, `e2-elnon-struck`. Keine Todesaussage.
- → `G.goto('e2-aufbruch')`.

### e2-aufbruch – „Letzte Hoffnung“ (F2 38:15–40:15)
- **Auftakt:** Tafel `e2-vamir-anhoehe` (violette Blitze); Tafel `e2-stadtwache`: eine Wache auf einer Brüstung über
  bewaldetem Hügelland sieht die violette Säule (keine Stadt, kein Ortsname, Quellenbefund §7). Danach kurzes
  Flick-Zwischenspiel (gerahmt, F2 38:38–39:19): Hornsignal, Flick versteckt sich im Unterholz, vier Verfolger suchen
  dicht daneben (`stealthGame('duck', …)` oder kleine Weltszene mit Sichtkegeln); sie bleibt unentdeckt.
- **Herzstück:** Morgengespräch mit Ignatius (Lia will los, er hält sie nicht für bereit; sie geht trotzdem, nimmt
  Schattentöter; Lia kann ihm eine Nachricht schreiben oder es ihm ins Gesicht sagen – Auswahl). Danach spielbarer Weg
  über `e2-herbsthang`: Pfad, Spurenblick auf ihre eigene Richtung (Flick? nein – nur Wild und alte Wege), am Ende ein
  Stück weißes Leinen im Busch; als Lia rastet, gleitet dicht hinter ihr etwas Helles mit blau-violettem Randleuchten
  vorbei (eine Gestalt? ein Gewand?), Lia dreht sich um (Interaktion), nichts ist da. Wahrnehmung, unbenannt, kein Zauber
  (Übergang zur Erscheinung in Teil III, ohne sie zu benennen). Tafel `e2-aufbruch`, Erzähler: Gruppe getrennt, Ziel offen.
- **Abschluss:** `e2-finished`, `setParty([])`, Credits „Ende des zweiten Buches“, `finishBook2()`.

## 4. Dateibesitz

| Bereich | Besitzer |
| --- | --- |
| `chapters/teil-2/index.ts`, `shared.ts`, `catalog.ts`, `chapters/common/bookContract.ts`, Kapitel-V-Anbindung | Integration (Orchestrator) |
| `chapters/teil-2/<szene>.ts` und szeneneigene Hilfsdateien `teil-2/<szene>-*.ts` | jeweilige Szenen-Lane |
| `game/public/assets/**`, `scripts/art/**`, `docs/rebuild/art/**` | Asset-Lane |
| `game/e2e/teil-2*.pw.ts` | Test-Lane |
| `game/src/tactics/**`, geänderte fremde e2e-Dateien | **niemand** (fremde laufende Arbeit) |

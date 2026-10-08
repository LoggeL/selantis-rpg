# Teil III „Falscher Glaube“: Umsetzung im Spiel

Verbindliche Szenenspezifikation für `game/src/chapters/teil-3/` (Kapitel-ID `teil-3`, `order: 7`, Karte
`numeral: 'Teil III'`, `title: 'Falscher Glaube'`). Grundlage: [Handoff](../handoff/teil-3/handoff.md),
[Szenenplan](../handoff/teil-3/story-plan.md), [Übergangsvertrag](../handoff/transition-contract.md),
[Quellenprüfung](quellenpruefung.md), [Adaptionsprotokoll](adaption.md), [Assets](assets.md). Teil II ist im
Arbeitsbaum vorhanden; der reguläre Übergang (`finishBook2()` → `G.goto('e3-valentus')`) ist auf dessen Seite schon
verdrahtet.

> **Vorrang (Nutzerentscheidungen 2026-10-08):** Diese Datei geht jeder abweichenden Zeile in Arbeitsaufträgen vor.
> (1) **Gewalt darf expliziter sein**: sichtbare Treffer, Blut und Blutlachen über `chapters/common/blood.ts`, wo die
> Handlung von Gewalt handelt (Falle, Ritualkampf, Vamirs Angriff auf Ignatius, Leichenfresser); kein Selbstzweck,
> keine Folter als Spielmechanik. (2) **Elnon ist tot**: Kyra hat ihn in Teil II gebannt getötet; der Spieler sah es,
> Lia nicht. Ein Auftrag, der „kein Blut“ oder „Elnons Schicksal offen“ verlangt, ist damit überholt.
>
> **Vorrang (Nutzer-Feedback 2026-10-09):** (3) Flick wird nicht von Leichenfressern gefangen, sondern von drei
> **Goblins: Ratz, Hotze und Fips** (Comic Relief, eigene Figuren und Porträts); sie hängt zu Beginn **kopfüber am
> Baum** (Tafel `e3-flick-kopfueber`). (4) Flick versucht Lia im falschen Lager zu befreien und wird von **Vamir
> versteinert**, nicht an einen Pfahl gebunden; die Fackel-und-Wolf-Aufgabe bleibt. (5) Jede Erinnerung der inneren
> Zuflucht zeigt eine Tafel, Lias Geist beobachtet am Rand. (6) „Augen öffnen“ zeigt je Szene, wer Lia
> gegenübersteht. (7) **Spürsinn** (Spurenblick) findet in jedem passenden Ort versteckte Hinweise; wo er nicht geht,
> sagt Lia warum (`MapDef.lookBlocked`, Daten in `spuersinn.ts`). (8) Die Relikte stehen sichtbar auf den Ständern.
> (9) Am Ende erscheinen **Valentus und Ignatius** als Geister. (10) Der **Epilog spiegelt die erste Szene von Teil I**
> (Lia liest unter der Eiche, Kyra kommt), dann stößt Flick in neuer Ausrüstung als Lias Beschützerin dazu.
> (11) Minispiele nur, wenn sie kreativ sind: reine Regler-Gesten sind durch Inszenierung oder kleine Entscheidungen
> ersetzt (Übersicht: `docs/minigames-review-2026-10-09.md`). Abweichende Zeilen unten sind damit überholt.

## 1. Grundregeln

- **Dialoge neu.** Kein Filmsatz wird übernommen. Filme liefern Ereignisse und Reihenfolge, die lokale
  Neutranskription (Quellenprüfung §1) die Beats. Höchstens ~140 Zeichen pro Box, Barks ~40.
  - **Lia**: belesen, trocken, ängstlich und widerborstig; denkt in Büchern; keine Kriegerin. Wächst durch
    Entscheidungen, nicht durch Lore-Vorträge.
  - **Kyra** (unter Einfluss bis zum Ritualkampf): freundlich, aber zu glatt, ungeduldig, weicht Fragen aus, kurze
    Härte im Ton („Keine Müdigkeit vortäuschen“ als Beat, eigene Worte). Danach: erschöpft, beschämt, braucht Raum.
    Kann nicht lesen (bleibt so).
  - **Flick**: Spott als Rüstung, „Leseratte“, handelt selbst (Flucht, Nachricht, Rettung, Stab).
  - **Ignatius**: warm, Bilder, Humor; verschweigt; in Trapas als Händler getarnt. Seine Schuld (Gwynn) ist echt.
  - **Der Großmeister** (Lichterorden, Trapas): fromm, entschlossen, rechnet in Tausenden; kein Schurke ohne Motiv.
    Er ist der Großmeister, über den Buch 1 Gerüchte erzählt (Rat der Drei, „jagt fremde Kulte“).
  - **Der Doktor** (Gelehrter des Ordens, zugleich Vamirs Kontaktmann): eitel, ungeduldig mit seinen Instrumenten.
  - **Vamir** (`e2-vamir`): leise, gelangweilt, grausam aus Kalkül; Gesicht bleibt unter der Kapuze.
  - **Baris** (`e2-baris`, vernarbt, Augenbinde): gedemütigt, gefährlich, hasst Flick.
  - **Valentus** (`e3-valentus`): müde, freundlich, knapp; begrenzte Erscheinung, türkis durchscheinend.
  - **Die Gestalt** (innere Zuflucht): unbenannt, sagt „ein Teil von dir“, keine Xenovia-Gleichsetzung.
- **Wissen trennen.** Gegner- und Flickszenen sind gerahmte Zwischenspiele (`interlude()`); Lia erwähnt deren Inhalt
  nie. Kyras Bericht ist Teil der Falle: Er erscheint im Tagebuch als „Kyras Bericht (unbestätigt)“. Der Spieler hat
  in Teil II Elnons Tod gesehen und erkennt den Bericht als Lüge; Lia weiß davon nichts und glaubt ihn zunächst.
- **Gewalt** wie in Teil II (Nutzervorgabe „Gewalt kann ruhig expliziter sein“): sichtbar, wo die Handlung von ihr
  handelt (Treffer, Blut, Blutlache über `chapters/common/blood.ts`), kein Selbstzweck, keine Folter als Spielmechanik.
  Ignatius stirbt ruhig an Vamirs violettem Schlag (kein Blut beim Sterben selbst; der Treffer darf hart wirken).
- **Farben:** Türkis nur Urmacht und Valentus' Erscheinung (`~…~`, `fx 'urmacht'`), Vamir violett `0x9a6cff`,
  Ignatius bernstein. Die Wisps an der Lichtung sind türkis (Urmacht-Bezug über Valentus).
- **Namen:** Lia, Kyra, Flick, Ignatius, Valentus, Vamir, Baris, Gwynn, Elnon. Stadt **Trapas**, Orden **Lichterorden**
  (Paladine des Lichterordens). Keine Reliktnamen. Der Doktor bleibt „der Doktor“ (Filmname unsicher).

## 2. Technik, Zustand und Übergänge

- Jede Szene ist ein Modul `teil-3/<szene>.ts` mit `export const scene: SceneEntry` über `e3Scene(id, title, start)`.
  `prepare()` ruft `prepareE3('<id>')` aus `shared.ts`: zuerst der dokumentierte Abschlusszustand von Teil II
  (`prepareBook2EndState()` aus `common/bookContract.ts`), dann kumuliert alle Teil-III-Szenen davor.
- Normale Übergänge nur `nextScene('<id>')` (= UI-Reset + `G.goto`). Kein `G.warp` im Spielfluss.
- Einmalige Gaben mit `grantOnce`. Abschluss-Flags am Szenenende, direkt vor dem Übergang.
- Gruppe: `setParty([])` bis zur Befreiung; im Ritualkampf kämpfen Verbündete als `ally`. Ab `e3-ignatius-abschied`
  `setParty(['kyra', 'flick'])`. Epilog-Begleiter `companions: ['kyra', 'flick']`.
- **Regulärer Einstieg** `e3-valentus`: erkennt einen echten Teil-II-Stand an `e2-finished` und verändert ihn nicht
  (kein Reset von Level, EXP, Inventar, Fähigkeiten). Offene Ziele aus Teil II werden geschlossen.

### Stäbe (verbindlich)

| Zustand | Flag | Inventar |
| --- | --- | --- |
| Teil II endet | `e2-staff-received` | `e2-schattentoeter` (geliehen) |
| Lia erhält ihren Stab (`e3-eigener-stab`) | `e3-stab-erhalten` | + `e3-lia-staff` |
| Lia gibt Schattentöter Ignatius zurück (`e3-eigener-stab`) | `e3-schattentoeter-zurueck` | − `e2-schattentoeter` |
| Paladine nehmen den Stab ab (`e3-paladine`) | `e3-stab-ort` = `'waffenkammer'` | − `e3-lia-staff` |
| Flick bekommt ihn von Ignatius (`e3-flicks-hilfe`) | `e3-stab-ort` = `'flick'` | – |
| Flick gibt ihn zurück (Ritualkampf) | `e3-stab-zurueck`, `e3-stab-ort` = `'lia'` | + `e3-lia-staff` |

`hasOwnStaff()` = `G.state.has('e3-lia-staff')`. Kampffähigkeit `e3-stabstrahl` nur mit Stab. `e2-stabimpuls` gilt nur mit
Schattentöter (nach der Rückgabe nicht mehr); Lia lernt mit dem eigenen Stab `e3-stabstrahl`. `liaLook()` wählt
`e3-lia-eigenstab` / `lia-cloak` / `e3-lia-gefesselt` nach Zustand.

### Gift (verbindlich)

`e3-vergiftet` von `e3-vertraute-schwester` bis `e3-hueterin`. Wirkung: langsameres Gehen (Spielerfigur),
Taumel-Barks, im Ritualkampf und im Duell 60 % LP und MP. Heilitems (`tincture`) wirken dagegen nicht (Tasche:
„Das ist kein Kratzer. Das sitzt tiefer.“). Kein Gegenmittel; in `e3-hueterin` sagt die Heilerin des Ordens, nur Ruhe
helfe; Flag `e3-gift-abklingend`. Die Urmacht verhindert den Tod, nicht die Schwäche.

### Vertragsflags und Zustandsfahrplan (`prepareE3` kumuliert)

| Szene | setzt am Ende |
| --- | --- |
| e3-valentus | `e3-valentus-getroffen` |
| e3-eigener-stab | `e3-stab-erhalten` (+ `e3-lia-staff`), `e3-schattentoeter-zurueck` (− `e2-schattentoeter`), `e3-ignatius-zurueck`, `learn('e3-stabstrahl')` |
| e3-paladine | `e3-gefangen-genommen`, `e3-stab-ort='waffenkammer'` (− `e3-lia-staff`), Wissen `e3-lore-lichterorden` |
| e3-schutzreaktion | `e3-schutz-ausgeloest` |
| e3-macht-und-schutz | `e3-untersucht`, `e3-verhandelt`, `e3-verhandlung-ton` |
| e3-falscher-glaube | `e3-gelauscht`, Hinweis `e3-hinweis-gwynn`, Wissen `e3-lore-glaube` |
| e3-kyras-fluchtweg | `e3-geflohen`, Hinweis `e3-kyras-bericht` |
| e3-waldgegner | `e3-flick-ghule` |
| e3-vertraute-schwester | `e3-vergiftet`, `e3-gift-plan` |
| e3-falle | `e3-gefangen` |
| e3-innere-zuflucht | `e3-zuflucht-1` |
| e3-flicks-hilfe | `e3-flick-gemeldet`, `e3-stab-ort='flick'`, `e3-orden-rueckt-aus` |
| e3-hoffnung-und-weigerung | `e3-geweigert`, `e3-relikte-plan` |
| e3-ritual | `e3-ritual-begonnen` |
| e3-ritualangriff | `e3-kyra-frei`, `e3-stab-zurueck` (+ `e3-lia-staff`), `e3-ritual-gebrochen`, Wissen `e3-lore-relikte` |
| e3-vamir | `e3-vamir-besiegt` |
| e3-ignatius-abschied | `e3-ignatius-tot`, `e3-versoehnt`, `setParty(['kyra','flick'])` |
| e3-hueterin | `e3-hueterin`, Item `e3-ordensfibel`, `e3-gift-abklingend`, Orden: `e3-orden-auftrag='schutz'` |
| e3-epilog | `e3-finished` |

## 3. Szenen

### e3-valentus – „Die Erscheinung“ (F3 00:21–02:00)
- **Ort:** `e3-lichtwald` (Wegteil), Herbstmorgen, Musik `exploration`→`refuge`.
- **Start:** Kapitelkarte „Teil III · Falscher Glaube · Ein eigener Stab“. Normalfall: `e2-finished` gesetzt, Lia allein
  mit Schattentöter. Erzählerbrücke: zwei Tage allein, Richtung unbekannt.
- **Herzstück:** Lia folgt dem Pfad; das Helle vom Hang (Teil II) zeigt sich wieder: türkise Lichtpunkte an den
  Bäumen, die sich nur im Spurenblick zu einer Spur ordnen (Q). Am Ende der Spur steht Valentus (durchscheinend,
  `valentus`, türkis getönt, schwebend). Gespräch mit Auswahl: Lia ist wütend (Eltern, Kyra, Flick, „Ihr habt mir das
  aufgeladen“). Er erklärt nur knapp: begrenzt, Erscheinung kostet Kraft, kein Totsein im üblichen Sinn, das Erscheinen
  löst nichts für sie. Er will ihr „etwas geben, das Ignatius ihr nicht geben kann: einen eigenen Stab“. Lia: „Ignatius
  sagt, ich sei nicht bereit.“ – er widerspricht nicht. Er geht voraus zur Lichtung.
- → `e3-eigener-stab`.

### e3-eigener-stab – „Ein eigener Stab“ (F3 04:38–05:35, Adaption: Wiederbegegnung)
- **Ort:** `e3-lichtwald` (Lichtung mit hängenden Ästen).
- **Herzstück 1:** Die Lichtgeister. Drei türkise Lichtpunkte schweben über der Lichtung; Valentus spricht mit ihnen
  wie mit alten Bekannten (Lia: „Ihr redet mit … denen?“). Sie fliehen, wenn Lia rennt; geht Lia langsam oder
  schleicht, folgen sie ihr. Ziel: alle drei Lichter zur alten Weide führen (sie folgen der Spielerin in der Nähe).
  Dann `storyAction('reach', 'Nach dem hellen Ast greifen')`: Ein heller Ast löst sich, wird in ihrer Hand zum Stab
  (Tafel `e3-eigener-stab`). `grantOnce('e3-stab-erhalten')`: Item `e3-lia-staff`, Look `e3-lia-eigenstab`.
- **Herzstück 2:** Erste Probe: drei verdorrte Samenkapseln an der Weide mit dem Stab „anstoßen“ (Interaktion
  „Stabstrahl“), Laterne/Wasser in der Nähe nicht treffen (Rückgriff Teil II). `learn('e3-stabstrahl')`.
- **Abschied Valentus:** Lia fragt, ob sie stark genug sei; er: nicht schwach; Macht plus Bereitschaft für Freunde.
  Er verblasst (Partikel). Lia allein: „Hoffentlich.“ (eigene Worte).
- **Wiederbegegnung (Adaption):** Ignatius kommt den Ostpfad herauf, außer Atem; er ist ihren Spuren gefolgt. Er
  sieht den Stab, erkennt Valentus' Handschrift. Auswahl: Lia gibt Schattentöter zurück (Pflicht, Tonwahl).
  `e3-schattentoeter-zurueck`. Er schlägt Trapas vor: Der Lichterorden hat Paladine, die einzigen, die Vamirs Leute
  angreifen könnten; er selbst sei dort nicht willkommen, darum als Händler. Lia stimmt zu, weil allein nichts geht.
  → `e3-paladine`.

### e3-paladine – „Händler und Tochter“ (F3 06:01–09:30)
- **Teil 1, Ort:** `e3-landstrasse`, Nachmittag. Paladinpatrouille (drei `paladin`) hält sie an. Ignatius als Händler.
- **Herzstück:** Die Deckgeschichte halten. Der Paladin fragt (Waren? Woher? Wohin?), Ignatius antwortet, Lia muss in
  zwei Momenten ergänzen (Auswahl): passende Antworten (Händler in Trapas lagert die Waren; Landweg von Portas
  gefährlich) halten den Paladin ruhig, unpassende (Hof, Schwester, Urmacht) wecken Misstrauen (`e3-tarnung` 0–2).
  Er will Ignatius mitnehmen; Lia hält ihn auf: „Er ist mein Vater“ (Auswahl der Worte, alle führen dahin). Beide
  werden gefesselt. Der Paladin nimmt den Stab („Und das Holz da nehme ich“) – Ignatius' Schattentöter ebenso. Wenn
  `e3-tarnung` hoch: der Paladin lobt ironisch den „Familiensinn“, sonst „Schlaue Wahl“.
- **Teil 2, Ort:** `e3-trapas` (Stadttor bis Ordenshaus), Look `e3-lia-gefesselt`, Ignatius `e3-ignatius-gefesselt`.
  Kurze geführte Strecke (Lia folgt der Eskorte; Abstand halten, sonst Ermahnung). Stop am Schmied: freie kurze
  Zeit in Reichweite (Leine): Banner des Ordens lesen (nur Lia kann lesen), Schmied, Stadt. Lia erkennt die Stadt aus
  Mutters Erzählungen: Mutter stammt aus Trapas (DESIGN §3, R). Ignatius staunt, dass sie lesen kann (Buch-1-Wissen
  schon bekannt? nein, er weiß es nicht). `e3-stab-ort='waffenkammer'`, Wissen `e3-lore-lichterorden`.
- → `e3-schutzreaktion`.

### e3-schutzreaktion – „Was in ihr wohnt“ (F3 08:35–10:54)
- **Ort:** `e3-ordenssaal`. Großmeister auf dem Hochstuhl, Hauptmann der Wache, Paladine.
- **Herzstück:** Verhör mit Auswahl. Ignatius bleibt beim Händler. Lia darf eingreifen (Tonwahl: schweigen, schützend
  lügen, wütend). Der Großmeister befiehlt, das Mädchen abzuführen und getrennt zu befragen. Ein Paladin packt Lia;
  Lia wehrt sich: `storyAction('reach', 'Sich losreißen')` – sie schafft es nicht, der Griff wird härter, und die
  Urmacht antwortet ohne ihr Zutun: türkiser Stoß (Tafel `e3-schutzreaktion`, fx, Kamera), alle weichen zurück,
  Kerzen verlöschen, Lia bricht zusammen (Pose). Abblende.
- Danach (Lia bewusstlos, Bild schwarz, nur Stimmen): Ignatius gibt die Tarnung auf: Er war einer der Zehn. Der
  Großmeister: Gefahr in falschen Händen; sie bleibt hier. Ignatius: Die Macht schützt sich und ihre Trägerin in
  größter Gefahr. Der Großmeister lässt den Doktor holen; Ignatius soll den Raum verlassen, er weigert sich, gibt nach.
- → `e3-macht-und-schutz`.

### e3-macht-und-schutz – „Untersuchung und Verhandlung“ (F3 10:54–13:57)
- **Teil 1, Ort:** `e3-gastzimmer`. `storyAction('open-eyes')`. Der Doktor mit Kristall, Kerze, Schale.
- **Herzstück 1 (Untersuchung, Adaption):** Lia muss mitmachen: Hand auf den Kristall (`storyAction('reach')`),
  in die Wasserschale hauchen, der Kerze zusehen. Jedes Instrument reagiert zu stark oder gar nicht, der Doktor
  flucht (Humor, Lia trocken). Ergebnis: starke Magie, Urmacht nicht nachweisbar („zu wenige Quellen“).
- **Verhandlung:** Großmeister kommt. Lia will gehen, Freunde retten. Er: hier am sichersten; „Was sind ein paar Leben
  gegen Tausende“. Lia: Ohne ihre Zustimmung bekomme niemand die Macht – und er habe gesehen, was sonst passiert.
  Auswahl bestimmt `e3-verhandlung-ton` (`'kalt'|'bittend'|'klug'`), Ergebnis gleich: Fesseln ab, Waffen bleiben in der
  Kammer, Lia bleibt. Ein Paladin verrät auf Nachfrage, Ignatius habe ein Zimmer auf derselben Etage, man solle sie
  getrennt halten.
- **Teil 2 (kleiner Ordenshub, Tag):** `e3-ordenshaus`. Optional: Waffenkammer hinter Gitter (ihr Stab hängt sichtbar
  darin, Hinweis `e3-stab-gesehen`), Bibliothek (Wissen `e3-lore-aros`), Kapelle mit Aros-Fenster, junger Paladin
  (Novize) am Brunnen, Ignatius' Tür (Wache verweigert). Pflicht: zurück ins Zimmer, schlafen.
- → `e3-falscher-glaube`.

### e3-falscher-glaube – „Falscher Glaube“ (F3 14:00–20:01)
- **Auftakt (gerahmt, „Weit entfernt …“):** `e2-halle`, Vamir an der Kugel (Tafel `e2-sehkugel` wieder), „Jetzt habe
  ich dich“ (eigene Worte), Kyra (gebannt) tritt vor; er schickt sie fort. Keine Technik benennen.
- **Lia erwacht nachts** im Zimmer, ein violetter Nachschein am Fenster verlöscht (unerklärt).
- **Herzstück (Schleichen, Lesen, Lauschen):** `e3-ordenshaus` bei Nacht, zwei Paladin-Wachen mit Laternen. Ziel 1:
  Bibliothek: Auf dem Pult liegt das Buch des Doktors (alte Abschrift, kein Titel); Lia liest drei Stellen (Schöpfung,
  „was den Ersten gehörte“, eine herausgerissene Seite) – keine Reliktliste. Ziel 2: am Arbeitszimmer des Großmeisters
  lauschen: im Schatten neben der Tür stehen bleiben, während die Wache vorbeigeht; Gespräch in drei Abschnitten,
  zwischen denen Lia in Deckung muss (Entdeckt → Checkpoint an der Tür, kein Game Over):
  1. Großmeister will die Urmacht für den Glauben an Aros im ganzen Land, „zum Wohl der Menschen“; Ignatius: Zwang.
  2. Ignatius: Sie könnte dabei sterben, sie ist keine Göttin. Großmeister: dann für Tausende. Vorwurf: Ignatius
     floh in die Wälder, verließ die Menschen.
  3. Großmeister: Gwynn – Ignatius wolle die Macht nur, um sie zu befreien. Ignatius widerspricht, dann: Lasst mich
     Gwynn holen, dann gehört Euch das Mädchen. Großmeister lehnt ab, droht mit Gericht wegen Fahnenflucht.
  Lia hört alles. `e3-hinweis-gwynn` („Was Ignatius gesagt hat“), Wissen `e3-lore-glaube`.
- Zurück ins Zimmer (Wache ausweichen). → `e3-kyras-fluchtweg`.

### e3-kyras-fluchtweg – „Durch den Schacht“ (F3 20:07–23:24)
- **Ort:** `e3-gastzimmer`, dann `e3-keller` (Keller → runder Brunnenschacht → Wassergang → Bach im Wald).
- **Kyra:** sitzt plötzlich im Zimmer. Wiedersehen (Lia außer sich vor Freude). Kyra wirft ihr dunkle Kleider zu,
  „später“. Während Lia sich umzieht/abwendet, steckt Kyra ein schmales Glasfläschchen vom Tisch des Doktors in
  den Gürtel (nur der Spieler sieht es: Kamera, Lia mit Rücken). Lia will ihren Stab aus der Waffenkammer holen;
  Kyra: keine Zeit, Wachen (Auswahl: Lia beugt sich, `e3-stab-zurueckgelassen`). Kyra kennt den Weg auffallend gut.
- **Herzstück (gemeinsame Flucht):** Lia folgt Kyra (Begleiterin führt, Lia steuert). Keller: einer Wache mit Laterne
  ausweichen (Sichtkegel, Verstecke hinter Fässern). Brunnenschacht: `storyAction('reach', 'Die Steigeisen
  hinunter')`. Wassergang: knietief (`shallow`, langsam), Lia friert (Barks), am Ende Gitter: Kyra hat es schon
  gelockert (Hinweis, Lia wundert sich). Draußen am Bach.
- **Kyras Bericht:** Rast im Laub. Lia fragt (Auswahl, Reihenfolge frei): Wie entkommen? Wo ist Flick? Elnon? Kyra:
  Flick sei vorher geflohen, um Hilfe zu holen; versprengte Rebellen hätten angegriffen, Elnon und sie seien
  geflohen, sie habe ihn verloren; ein Lager versprengter Rebellen liege nah. Lia: ohne Stab, zaubern nur ein wenig.
  Kyra fragt nichts zurück (auffällig). Hinweis `e3-kyras-bericht` (unbestätigt). Der Bericht über Elnon ist eine
  **Lüge**: Der Spieler hat in `e2-kontrolle` gesehen, wie Kyra ihn tötete. Die Szene spielt das aus, ohne es
  auszusprechen (Kyra sagt den Elnon-Satz glatt und ohne Pause, `e2-kyra-gebannt` `cold`/`devoted` nur als Andeutung;
  Lia glaubt ihr und will ihn retten). Kein Hinweis für Lia, kein Erzählerkommentar. → `e3-waldgegner`.

### e3-waldgegner – „Kopfüber“ (F3 23:37–24:51) — Flicks Zwischenspiel
- **Rahmung:** `interlude('Unterdessen, ein paar Täler weiter …')`. Ort: `e3-ghulwald` (Hintergrund `k5-faehrte`),
  Abend. Spielerfigur `e2-flick-gefangen`, kopfüber am Eichenast (Pose `hang`, Tafel `e3-flick-kopfueber`). Drei
  Goblins (`goblin-ratz` der selbsternannte Häuptling, `goblin-hotze` der Koch, `goblin-fips` der Kleinste, der sie im
  Netz gefangen hat) streiten, wie sie gekocht wird.
- **Herzstück (Intrige):** Flick kann nur reden und spielt die drei in vier Schritten gegeneinander aus
  (`waldgegner-lager.ts` `STEPS`): Hotze um die Ohren fürchten lassen, Ratz das „erste Stück“ versprechen (er befiehlt
  Fips, sie herunterzuschneiden), Fips mit einer Spange bestechen (Knoten locker), Streit um die Ohren anzetteln.
  Falsche Sätze bekommen eine komische Antwort und werden ausgegraut. Während die drei raufen, schlüpft sie aus der
  Schlinge; danach Schleichweg weg vom Feuer (Sichtkegel, Farn als Versteck). Ratz schickt Fips hinterher (Ton).
  `e3-flick-ghule`. → `e3-vertraute-schwester`.

### e3-vertraute-schwester – „Ein Becher Tee“ (F3 25:51–28:18)
- **Ort:** `e3-waldrast` (Hintergrund `k3-leselager`), Nacht, kleines Feuer. Companion Kyra.
- **Herzstück:** Lagerabend mit Auswahl: Lia erzählt (Ignatius, Valentus, der Stab, Trapas, was sie gehört hat –
  Kyra hört genau zu, wenn es um Trapas und Paladine geht). Kyra reicht einen Becher Tee (`storyAction('lift')`).
  Lia: „Du bist so ruhig geworden.“ Kyra will nicht reden. Lia fühlt sich schlecht, schläft.
- **Schnitt (gerahmt):** `e2-halle`, Vamir zu Baris: Kyra schwächt die Schwester mit einem seiner Mittel; tödlich für
  jeden anderen, die Urmacht verhindert das, nicht die Schwäche. Kyra führt sie in ein abgelegenes Lager, Baris lässt
  die Falle zuschnappen. Paladine? Ein Spion halte ihn auf dem Laufenden, und die hätten gerade andere Sorgen.
- **Morgen:** Kyra weckt Lia hart (fremder Ton, eigener Wortlaut). `e3-vergiftet`: langsames Gehen, Taumeln, Tinktur
  wirkt nicht. Kurzer Weg zum Lager. → `e3-falle`.

### e3-falle – „Die Falle“ (F3 29:09–30:20)
- **Ort:** `e3-falsches-lager`, Vormittag. Leere Zelte, ein Feuer, das niemand hütet.
- **Herzstück:** kurze Erkundung mit Spurenblick: frische Stiefelspuren mit Nagelmuster der Dunkelschatten,
  schwarz-weißer Stofffetzen, ein Käfigwagen unter einer Plane. Je mehr Lia findet (0–3), desto deutlicher denkt sie
  es aus (`e3-falle-hinweise`), Kyra drängt weiter. Nach dem dritten Fund oder am Feuer: Falle. Baris und Männer
  packen Lia (Tableau, Tafel `e3-falle`). Lia: „Kyra, wie konntest du?“ Kyra: Befehl ihres Meisters (eigene Worte,
  Stimme flach, Porträt `e2-kyra-gebannt`). Vamir tritt aus Rauch: endlich. Lia: nie. Käfig.
- → `e3-innere-zuflucht`.

### e3-innere-zuflucht – „Die innere Zuflucht“ (F3 30:56–33:28)
- **Ort:** `e3-innenwelt` (Nebelwiese), Look `e3-lia-innen`. Deutlich als Bewusstseinsebene gerahmt (Nebelränder,
  gedämpfter Ton, keine HUD-Zielmarke außer Text).
- **Herzstück:** Erinnerungen aus Buch 1 finden: drei helle Stellen im Nebel (Buch unter der Eiche, Kyra mit
  Feuerholz, Mutter liest vor) – jede zeigt eine kurze Erinnerung (Text, `say`), danach wird die Wiese größer.
  Zwischen den Erinnerungen dringen gedämpfte Stimmen von außen herein (Vamirs Männer), ohne Bild.
- **Schnitt (gerahmt, Spielerwissen):** Vamir vor seinen Männern: großer Sieg; lobt Kyra, sie dankt. Flick bricht
  aus dem Gebüsch und rennt zum Käfigwagen; Vamir hebt nur die Hand und **versteinert** sie mitten im Lauf (Tafel
  `e3-flick-versteinert`, Look `e3-flick-stein`, `versteinerung.ts`). Baris will die Statue zerschlagen; Vamir: Stein
  hört zu, der Bann hält bis in die Nacht, dann gehört sie den Wölfen. Baris höhnt.
- → `e3-flicks-hilfe`.

### e3-flicks-hilfe – „Flicks Nachricht“ (F3 32:16–34:49) — Flicks Zwischenspiel
- **Teil 1:** `e3-falsches-lager` am Abend, verlassen. Spieler Flick steht als Statue, wo der Bann sie traf. Mit der
  Nacht bekommt der Stein in drei Stufen Risse, während Wolfsaugen am Rand näherkommen; dann bricht sie heraus.
  Herzstück: einen Feuerbrand aus der Glut ziehen und rückwärts zum Weg gehen, die Wölfe auf Abstand.
  Spurenblick: Wagenspuren des Käfigs nach Osten (sie weiß jetzt, wohin).
- **Teil 2:** `e3-ordenssaal`, Nacht. Flick (normaler Look `flick`) wird vorgeführt. Großmeister misstraut (Vamirs
  Leuten?). Flick: sie habe es gesehen, sie kenne den Weg. Auswahl: Wie Flick überzeugt (Spott, Ehrlichkeit,
  Ignatius ansprechen). Ignatius verbürgt sich. Großmeister: Der Orden rückt aus. Ignatius holt den Stab aus der
  Kammer, gibt ihn Flick: Sie wird schneller bei ihr sein. `e3-stab-ort='flick'`, `e3-orden-rueckt-aus`.
- → `e3-hoffnung-und-weigerung`.

### e3-hoffnung-und-weigerung – „Hoffnung“ (F3 34:58–38:17)
- **Teil 1:** `e3-innenwelt`. Die Gestalt (weiß, durchscheinend): „ein Teil von dir“. Sie erklärt: Unterbewusstsein,
  Schutz vor dem, was draußen geschieht; sie wollen dich wecken, weil sie glauben, du müsstest die Macht freiwillig
  geben, wie Valentus es tat. Lia: Kyra gebannt, Flick weg, Ignatius wollte nur ihre Macht (sie hat ihn gehört). Die
  Gestalt: Hilfe kommt von außen; Hoffnung. Herzstück: Gespräch mit Auswahl + Nebelriss: Lia hält die Wiese
  zusammen, während violette Risse auftauchen (zu den Rissen gehen und sie mit ruhigem Stehen schließen; drei Mal),
  beim vierten reißt es: Vamir weckt sie.
- **Teil 2:** `e2-halle`, Lia gefesselt (`e3-lia-gefesselt` kneel). Vamir verlangt die Macht, droht mit Schmerz.
  Lias Weigerung (Auswahl der Worte, keine nachgiebige Option). Vamir: dann nimmt er sie sich.
- **Teil 3 (gerahmt, Spielerwissen):** Der Kontaktmann kommt: Es ist der Doktor. Er sollte für den Großmeister einen
  Weg finden; das alte Buch beschreibt, wie die Zehn Xenovia die Urmacht nahmen: Trägerin und die Relikte der ersten
  zehn Menschen an einem Ort, alle auf sie gerichtet. Vamir: Heiligtümer aus den Plünderzügen. Tafel `e3-relikte`.
  `e3-relikte-plan`. → `e3-ritual`.

### e3-ritual – „Das Ritual“ (F3 38:29–40:39)
- **Teil 1 (Lia):** `e3-ritualhuegel`, Dämmerung. Lia liegt gefesselt auf dem Stein (Pose `lie`), zehn Ständer mit
  verhüllten Gegenständen im Kreis. Baris höhnt. Lia ruft Kyra; Kyra reagiert nicht. Vamirs Rede (letzte freie Städte,
  neue Zeit, eigene Worte). Tafel `e3-ritual`, türkise Kugel bildet sich.
- **Teil 2 (Flick, Herzstück):** Waldrand unterhalb des Hügels, Spieler Flick mit Bogen, Ignatius und Paladine hinter
  ihr. Flick späht mit Spurenblick die Posten aus (drei Wachen markieren: Interaktion „Posten zeigen“ in Sichtweite)
  und wählt den Anstieg (Auswahl zwischen Hohlweg/Felsen/offen; alle führen zum Kampf, ändern Startpositionen).
  `e3-ritual-weg`. Flick schießt den ersten Pfeil („Wer war das?“ – „Ich.“, eigene Worte). → `e3-ritualangriff`.

### e3-ritualangriff – „Am Stein“ (F3 40:39–42:27)
- **Taktikkampf `e3-ritualangriff`** (isometrisch, Hügel mit Stein in der Mitte, zehn Ständer `iso-stake` um den Stein).
  - Einheiten Spieler: Flick (Bogen, Messer), Ignatius (ally, `ai: guard`, bernstein `e3-bernsteinwall` = Decken),
    zwei Paladine (ally). Lia gefesselt auf dem Stein (Einheit `lia`, `boundPreset: 'e3-lia-gefesselt'`, nicht
    steuerbar bis befreit).
  - Gegner: Baris (vernarbt, `nonLethal`), 4–5 Dunkelschatten, Kyra (gebannt, `nonLethal`, greift an).
  - **Ritualleiste (Spieldesign):** Jede Gegnerrunde steigt die Ladung um 1 (Ziel 8). Ein Ständer kann von einer
    angrenzenden Spielereinheit umgestoßen werden (Aktion „Ständer umstoßen“): Ladung −1, höchstens zehn. Erreicht
    die Ladung 8: Niederlage („Das Ritual hat sie fast geleert“), Erneut versuchen.
  - **Befreiung:** Flick oder ein Paladin neben dem Stein → „Fesseln lösen“ (Rettungsziel wie `tactics-rescue-demo`).
    Danach Lia steuerbar; wenn Flick neben ihr steht oder sobald Flick sie erreicht: Stabrückgabe (Hook: Tafel
    `e3-stabrueckgabe`, `e3-stab-zurueck`, + `e3-lia-staff`, Lia erhält `e3-stabstrahl`). Lia vergiftet: 60 % LP/MP.
  - **Kyra:** Wird Baris kampfunfähig, bricht Kyras Bann (sichtbar: violetter Schimmer reißt ab, sie lässt das
    Schwert fallen, kniet). Sie wechselt das Team (ally, `nonLethal`). Zeitliche Kopplung wie im Film; Ursache
    bleibt unerklärt (Adaption dokumentiert). Kyra kann nicht kampfunfähig werden (Niederlage nie durch Kyra).
  - **Sieg:** Baris kampfunfähig (zieht sich zurück) und Ritual unterbrochen (Lia befreit), übrige Gegner fliehen.
    Vamir ist nicht Einheit: Er verschwindet in Rauch, als Lia frei ist („Später.“) – Ignatius folgt ihm.
  - **Niederlage:** Flick fällt, oder Ladung 8. Belohnung einmal (`e3-ritual-gewonnen`).
- Nach dem Kampf: Kyra „ist es vorbei?“, Lia froh, Kyra wieder sie selbst; Flick: „Hier, Zauberin.“ (Stab, eigene
  Worte). Wo ist Ignatius? Er ist Vamir nach. Aufteilen. → `e3-vamir`.

### e3-vamir – „Vamir“ (F3 42:37–43:30)
- **Ort:** `e3-waldpfad`, später Nachmittag. Lia allein (Kyra und Flick suchen anders).
- **Herzstück 1:** Spurenblick: violette Brandspuren, Ignatius' verlorener Schattentöter, Fußspuren. Lia hört Vamir.
- **Tableau:** Vamir über dem knienden Ignatius; Ignatius trotzt; violetter Stoß; Lia schreit. Vamir höhnt.
- **Herzstück 2: Duell `e3-vamir-duell`** (Taktik, kleine Waldkarte). Lia (vergiftet 60 %, `e3-stabstrahl`,
  `lichtstoss` falls bekannt, `ausweichen`) gegen Vamir (`nonLethal: false`, kann nicht sterben vor dem Finale:
  Endstoß skriptet). Vamir: violetter Schild (blockt Schaden, bis ein Stabstrahl ihn bricht), Schattenranken (Fläche),
  Teleport alle 2 Runden. Ignatius liegt am Rand (nicht steuerbar). Unter 30 % LP oder nach 3 Schildbrüchen: Hook
  „Urmacht“ – Lia richtet den Stab, Tafel `e3-vamir-fall`, Vamir löst sich violett auf. Niederlage: Erneut versuchen.
  Belohnung einmal (`e3-duell-gewonnen`).
- `e3-vamir-besiegt`. → `e3-ignatius-abschied`.

### e3-ignatius-abschied – „Abschied“ (F3 43:38–44:18)
- **Ort:** `e3-waldpfad` (Waldrand), Ignatius liegt (`e2-ignatius` lie).
- **Herzstück:** ruhiges Gespräch mit Auswahl. Lia kniet (`storyAction('tend', 'Seine Hand halten')`). Hat sie eine
  Tinktur: Versuch angeboten, er wehrt sanft ab („Das hier ist keine Wunde, die man verbindet“). Er erkennt ihren
  Fortschritt, entschuldigt sich: feige, eigennützig; Gwynn ist längst tot, er wollte es nicht glauben. Lia verzeiht
  (Auswahl der Worte; alle verzeihen, eine fragt erst nach, eine wütend-verzeihend). Er: der Körper eine Hülle, er
  wacht von anderswo (Trost, keine Nachweltkarte). Letzte Zeile: Sie ist nie allein. Hand wird reglos.
- Flick und Kyra kommen („Hier!“). Stille. `e3-ignatius-tot`, `e3-versoehnt`, Party Kyra+Flick. → `e3-hueterin`.

### e3-hueterin – „Hüterin“ (F3 45:06–45:28)
- **Ort:** `e3-trapas` (Platz vor dem Ordenshaus), Tag, Menschen, Banner. Lia mit Stab.
- **Herzstück:** Vor der Zeremonie: kurze Runde über den Platz (Heilerin: Gift – nur Ruhe hilft; Paladine; der Doktor
  ist verschwunden, sein Zimmer leer (offen); ein Händler kannte Mutters Familie vom Namen her (optional, kein Name)).
  Zeremonie: Großmeister bekennt, die Augen geöffnet; Auftrag des Ordens fortan Schutz der Menschen, nicht Verbreitung
  des Glaubens; er ernennt Lia zur Hüterin, Schutz des Ordens. Lias kurze Antwort (Auswahl, drei Tonlagen, keine
  Herrschaft). Item `e3-ordensfibel` (grantOnce). Ignatius wird erwähnt (Grab in Trapas? nein: Lia legt Schattentöter
  im Ordenshaus nieder, „bis jemand ihn braucht“ – optional).
- → `e3-epilog`.

### e3-epilog – „Zu dritt“ (F3 46:03–46:59)
- **Neu (2026-10-09):** Aufbau wie die erste Szene von Teil I auf der Herbstwiese hinter dem Hof (`k1-wiese`): Lia
  liest unter der Eiche (Tafel `e3-epilog-wiese`), Kyra kommt mit Feuerholz und schleicht sich an (Lia hört sie
  diesmal), dieselben drei Antworttöne, die Eltern wären stolz, dann kommt Flick stolz in neuer Ausrüstung als Lias
  Beschützerin (`flick-beschuetzerin`), Kyras Elnon-Geständnis, freie Zeit (Buch aufheben, leeres Nest im Spurenblick,
  Kornblumen, Äpfel), Aufbruch nach Osten; unter der Eiche erscheinen Valentus (türkis) und Ignatius (bernstein,
  `AMBER_GHOST`). Tafel `e3-epilog-geister`. Die folgenden Zeilen beschreiben den alten Feldweg-Entwurf.
- **Ort (alt):** `e3-feldweg`, Morgen. Companions Kyra und Flick.
- **Herzstück:** gemeinsamer Weg mit Gesprächen beim Gehen: Kyra (seit dem Sommer ist alles anders; Eltern sähen zu
  und wären stolz), Kyra über Elnon und das Schwert: Sie erinnert sich an die Klinge in ihrer Hand und an sein
  Gesicht; sie weiß jetzt, dass er tot ist und dass sie Lia über ihn angelogen hat. Lia erfährt hier erst, dass Elnon
  tot ist (Auswahl, wie sie reagiert; alle tröstend: es war nicht dein Wille). Kyra will den Rebellen im Süden die
  Wahrheit sagen. Flick als Leibwächterin („Der Großmeister zieht mir das Fell ab, wenn …“,
  eigene Worte). Optional: Rückkehr zu den Elterngräbern als Versprechen (kein Besuch). Am Wegende Valentus'
  Erscheinung im Vordergrund (nur der Spieler sieht sie; Lia dreht sich nicht um). Tafel `e3-epilog`.
- `e3-finished`, Speicherpunkt, Abspann „Ende des dritten Buches“, Titel. Fortsetzen nach Ende: Schlusswahl
  (Abspann / Titel).

## 4. Dateibesitz

| Bereich | Besitzer |
| --- | --- |
| `chapters/teil-3/**` | Teil III (dieser Auftrag) |
| `game/public/assets/**`, `scripts/art/**`, `docs/rebuild/art/**` (additiv) | Asset-Lane |
| `game/e2e/teil-3*.pw.ts`, `game/e2e/teil3Helpers.ts` | Test-Lane |
| `chapters/teil-2/**`, `chapters/common/bookContract.ts` (nur lesen; Anschluss ist dort fertig) | Teil II |
| `game/src/tactics/**` | fremde laufende Arbeit: nur lesen |

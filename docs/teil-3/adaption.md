# Teil III „Falscher Glaube“: Adaptionsprotokoll

Jede Abweichung vom Film, jede neue Verbindung und jede bewusst neutrale Auslassung. Filmbelege mit Zeitmarke (F3 mm:ss,
nach `sources/transcripts/03-c9oV3Lh2Lyw.large-v3.txt`), Quellenbefunde: [Quellenprüfung](quellenpruefung.md).

## Rahmen

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Teil III als Kapitel `teil-3` (`order: 7`), 19 Szenen `e3-…` | Struktur | Übergangsvertrag; Szenenplan des Handoffs. Die vorgeschlagenen Szenen `e3-naechtliche-zeichen` (Auftakt von `e3-falscher-glaube`) und `e3-die-zehn-relikte` (Teil 3 von `e3-hoffnung-und-weigerung`) sind als gerahmte Abschnitte integriert. |
| Lia heißt Lia (Film: Triss); Elnon = Film-Elhon; Baris = Kämpfer mit roter Augenbinde | Namen | DESIGN.md §7.2, Quellenprüfung §1.10 |
| Stadt Trapas, Orden = Lichterorden, Großmeister = Großmeister des Rats der Drei aus den Buch-1-Gerüchten | Verbindung | Quellenprüfung §1.1–2; Kapitel II/III nennen Lichterorden und Großmeister in Trapas |
| Der Doktor ist Vamirs Kontaktmann | Verbindung | Quellenprüfung §1.3–4 |
| Gwynn wird genannt | Kanon | Quellenprüfung §1.5 |
| Stab bei der Festnahme beschlagnahmt, in der Waffenkammer verwahrt; Ignatius gibt ihn Flick | Spieldesign | Film: „in Trapas gelassen“, Rückgabe durch Flick (Quellenprüfung §1.13) |
| Schattentöter geht bei der Wiederbegegnung an Ignatius zurück | Spieldesign | Vertrag: getrennte Gegenstände; Handoff verlangt dokumentierte Rückgabe |
| Wiederbegegnung mit Ignatius nach dem Stab | Spieldesign | Film zeigt keinen Anschluss (Szenenplan, offene Frage 1) |

## Spieldesign und Szenen

Je Szene: neue Mechaniken, Abweichungen vom Film und bewusst neutrale Formulierungen.

### e3-valentus – „Die Erscheinung“ (`teil-3/valentus.ts`, Regeln `valentus-spur.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Regulärer Einstieg aus Teil II: `enterBook3()` schließt nur offene Ziele und leert die Gruppe; Level, EXP, Inventar, Fähigkeiten und Entscheidungen bleiben. Kapitelkarte „Teil III · Falscher Glaube · Ein eigener Stab“, Erzählerbrücke: zwei Tage allein, Richtung unbekannt | Struktur | Übergangsvertrag; umsetzung.md §2 |
| Eigene Karte `e3-lichtwald-pfad` auf dem Hintergrund `e3-lichtwald`: nur Pfad, Nische und Wiese; der Durchgang zur Lichtung ist das Ende des Wegs | Spieldesign | Szene spielt am Wegteil (umsetzung.md §3); die Lichtung gehört der Folgeszene |
| Fünfzehn türkise Lichtpunkte hängen verstreut an Bäumen und Büschen. Nur im Spurenblick (Q) gleiten fünf davon zu einer Linie entlang des Pfads, von Lia bis zur nächsten von drei Sammelstellen (Stumpf, Felsen, Felsblock am Durchgang). Lia liest alle drei, dann erscheint Valentus | Spieldesign | Film zeigt die Erscheinung ohne Weg (F3 00:21); das Helle vom Hang (Teil II) zeigt sich wieder. Lichtpunkte sind Code-Effekte, keine Figuren |
| Valentus ist die vorhandene Figur `valentus`, türkis getönt, durchscheinend, mit Schein, kleinem Urmacht-Licht und leichtem Schweben (`erscheinung.ts`) | Darstellung | Keine neue Figurenkunst; Türkis nur Urmacht/Valentus |
| Lia erkennt ihn an Ignatius’ Beschreibung, statt dass er sich als Retter aus der Wiege vorstellt | Adaption | Lia kennt die Geschichte seit `e2-urmacht`; vermeidet die Filmzeile |
| Vorwürfe als Auswahl (Eltern, Kyra und Flick, „aufgeladen“), beliebig viele, erste Wahl in `e3-val-vorwurf`. Er antwortet knapp, erklärt nur: begrenzt, das Bild kostet Kraft, „woanders“ statt tot, sein Erscheinen löst nichts | Spieldesign | umsetzung.md §3; keine Lore-Vorträge, keine Wiederbelebungsregel |
| Lia weiß nicht, dass Flick entkommen ist; sie hält beide Freundinnen für gefangen | Kanon | Teil II, Wissen getrennt |
| Technik: Die Erscheinung färbt das Sprite nach jedem Bild (Szenen-Ereignis `postupdate`) und dämpft den Bodenschatten über einen defensiven Zugriff auf die Figurenliste der Weltszene; fehlt er, bleibt nur der Schatten kräftiger | Technik | Welt-Engine bietet keine Alpha/Tönung für Figuren; nichts außerhalb von `teil-3` geändert |
| Er widerspricht Ignatius’ „nicht bereit“ nicht, bietet aber einen eigenen Stab an („Leihen ist gut für den Anfang“) | Adaption | Beat aus F3 01:25–01:50 in eigenen Worten |

### e3-eigener-stab – „Ein eigener Stab“ (`teil-3/eigener-stab.ts`, Regeln `eigener-stab-geister.ts`, `eigener-stab-ziele.ts`, `eigener-stab-gaben.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: Lichtung (Lichter, Ast, erster Strahl, Abschied) und `{ part: 'ignatius' }` (Wiederbegegnung). Ein Neuladen startet den laufenden Abschnitt neu | Struktur | Kein Verlust des Stabs nach dem Abschied; Rückgabe und Plan sind ein eigener Abschnitt |
| Drei türkise Lichtgeister (Code-Lichter): Rennen verscheucht sie, langsames Gehen bis dicht heran oder Schleichen aus etwas größerer Entfernung lässt sie folgen; unter der Weide setzen sie sich in die Zweige und bleiben dort. Lias Tempo wird aus ihrer Bewegung gemessen | Spieldesign | umsetzung.md §3, Herzstück 1; Film: Valentus spricht mit „diesen Dingern“ (F3 04:50) |
| Der helle Ast: `storyAction('reach')` mit Nahbild der Weide, Tafel `e3-eigener-stab`, danach `grantOnce('e3-stab-erhalten')` (+ `e3-lia-staff`, Ort `lia`), Aussehen `e3-lia-eigenstab` | Spieldesign | Übergabe verbindlich (Handoff); kein Name, keine Sonderkraft |
| Erste Probe: drei verdorrte Samenkapseln in der Weide mit dem Stabstrahl herunterstoßen. Statt einer Laterne gelten die drei Lichter in den Zweigen als „nicht treffen“, dazu der Bach; der Stamm ist neutral. Fehlschüsse sind nur Kommentare. Danach `learn('e3-stabstrahl')` | Abweichung | Eine Laterne passt nicht auf die Waldlichtung; die Lichter erfüllen dieselbe Rolle wie Nest und Laterne in Teil II |
| Das Zielfenster nennt das anvisierte Ding in einer zweiten Zeile („Eine trockene Kapsel …“, „Eines der Lichter.“) | Spieldesign | Gemalte Kapseln sind klein; Entscheidung statt Suchbild |
| Abschied: „nicht schwach“ als konkrete Beobachtung (zwei Tage allein gelaufen) und „mehr Licht, als ich je hatte, und du weißt, für wen“; Valentus löst sich in Partikel auf; Lia: „Ich hoffe sehr, Ihr wisst, wovon Ihr redet.“ | Adaption | F3 05:15–05:36 als Beat, Wortlaut neu, kein Pathos |
| Ignatius folgte ihren Spuren; seine erste Zeile nimmt den Abschied aus Teil II auf (`e2-abschied` Rinde / ins Gesicht / ohne Angabe) | Adaption | Szenenplan, offene Frage 1 |
| Schattentöter-Rückgabe als Pflicht mit Tonwahl (`e3-rueckgabe-ton` warm / stolz / dankbar), `grantOnce('e3-schattentoeter-zurueck')`, − `e2-schattentoeter` nur, wenn Lia ihn trägt | Spieldesign | Getrennte Gegenstände (Vertrag); Inventar ist die Wahrheit |
| Ignatius schlägt Trapas vor: Paladine des Lichterordens, er selbst dort nicht willkommen („alte Geschichte“, ohne Gwynn zu nennen), darum als Händler, Waren „bei einem Bekannten in der Stadt“. Die Tochter-Tarnung bleibt Lias spontane Idee in `e3-paladine` | Adaption | Film zeigt den Anschluss nicht (Quellenprüfung §1.1); Deckgeschichte bleibt Tarnung |
| Lia nennt Trapas als Marktstadt ihres Vaters; die Verbindung zur Mutter bleibt `e3-paladine` | Kanon | DESIGN.md §7 (Vater fährt zum Markt nach Trapas) |

### e3-paladine – „Händler und Tochter“ (`teil-3/paladine.ts`, Orte `paladine-orte.ts`, Regeln `paladine-regeln.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: Landstraße (Standard) und `{ part: 'trapas' }` (nur mit `e3-pal-gefesselt`, gesetzt direkt vor dem Übergang). Ein Neuladen startet den laufenden Abschnitt neu; der Stab ist im Trapas-Abschnitt schon in der Waffenkammer | Struktur | Reload-Regel; die Beschlagnahme wird nicht wiederholt |
| Eigene Karten-IDs `e3-landstrasse` und `e3-trapas-eskorte` (Hintergründe `e3-landstrasse`, `e3-trapas`); die Geometrie liegt in `paladine-orte.ts` und kann von `e3-hueterin` mitbenutzt werden | Technik | `defineMap`-IDs sind global; eine spätere Karte auf demselben Platz braucht eine eigene ID |
| Ignatius probt die Deckgeschichte einmal beim Gehen (Händler, Ware bei einem Händler in Trapas, zu Fuß von Portas, weil volle Wagen ausgeräumt werden); optional liest Lia den Meilenstein | Spieldesign | Die Spielerin muss die passenden Antworten kennen, bevor sie geprüft wird |
| Herzstück „Deckgeschichte halten“: zwei Antworten Lias (Ware: Händler am Markt / Hof / Schwester; zu Fuß: Landweg geplündert / „etwas folgt uns“ / Pilger zum Verbannungsfest im Herbst). `e3-tarnung` = Zahl der passenden Antworten (0–2). Fehltritte bügelt Ignatius aus (Hof hinter dem Laden, Schwester führt die Bücher, Wölfe), der junge Paladin wird schärfer | Spieldesign | umsetzung.md §3; Film F3 06:01–06:40 als Beat, alle Zeilen neu. Das Verbannungsfest (Sommer, DESIGN §7.1) macht die Pilgerlüge erkennbar |
| Der Ausgang ist für alle gleich: Der Führer will Ignatius mitnehmen und Lia gehen lassen; „Er ist mein Vater“ in drei Wortlauten (`e3-vater-wahl` halt / allein / frech), dann werden beide gefesselt | Spieldesign | Filmverlauf F3 06:48–07:15; die Wahl färbt nur den Ton |
| Abschiedsbemerkung des Führers nach `e3-tarnung`: bei 2 ironisch über den „Familiensinn“, sonst trocken „Vernünftig …“ | Spieldesign | umsetzung.md §3; nicht der Filmsatz „Gute Wahl“ |
| Beschlagnahme mit Tafel `e3-paladine`: Der Führer nimmt Lias hellen Stab, der junge Paladin meldet Ignatius’ Schattentöter, beide „in die Waffenkammer“. `confiscateStaffs()` = `staffAway('waffenkammer')` (− `e3-lia-staff`, `e3-stab-ort`), nimmt einen noch getragenen `e2-schattentoeter` ebenfalls; Aussehen danach `e3-lia-gefesselt` und `e3-ignatius-gefesselt` | Spieldesign | Stabregel umsetzung.md §2; Inventar ist die Wahrheit. Ignatius’ eigener Stab liegt nur erzählerisch in der Waffenkammer (kein Inventarobjekt Lias) |
| Trapas: Tafel `e3-trapas` vor dem Tor, dann geführte Strecke. Lia folgt dem Führer; der junge Paladin und Ignatius mit Wache folgen ihr. Der Führer geht erst weiter, wenn Lia nah ist (≤ 74 px); über 140 px ermahnt der junge Paladin, über 210 px wird sie zurückgeholt (kurze Szene) | Spieldesign | „Abstand halten, sonst Ermahnung“ (umsetzung.md §3); kein Scheitern, kein Game Over |
| Halt an der Schmiede: freie Zeit an einer Leine (Ellipse über der Westhälfte des Platzes; außerhalb holt der Paladin sie zurück). Drei Stellen: Aushang am Bannermast (nur Lia kann lesen, Wissen `e3-lore-lichterorden`; Ignatius wusste nicht, dass sie liest, bzw. mit `e2-abschied = 'brief'` staunt er nur über die verschnörkelte Ordensschrift, weil er ihre Rinde schon gelesen hat; Lia: Mutter kam aus Trapas), der Schmied (zweihundert Speerspitzen für den Orden), der Brunnen aus Mutters Erzählungen. Optional: Gespräch mit Ignatius über das „Vater“ | Spieldesign | umsetzung.md §3; der Aushang ersetzt ein „Banner lesen“, weil die Banner nur den weißen Vogel tragen (keine Schrift im Bild) |
| Der Aushang nennt den Großmeister nur mit Titel; Belohnung zwei Silberstücke, Tore schließen bei Sonnenuntergang | Adaption | Keine Namen, die der Film nicht liefert |
| `e3-gefangen-genommen` und das Wissen werden erst am Portal des Ordenshauses gesetzt, direkt vor dem Übergang | Struktur | Abschlussflags am Szenenende (umsetzung.md §2) |

### e3-schutzreaktion – „Was in ihr wohnt“ (`teil-3/schutzreaktion.ts`, Saal `schutzreaktion-saal.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Eigene Karten-ID `e3-ordenssaal-verhoer` auf `e3-ordenssaal`; Geometrie und Kerzenlichter in `schutzreaktion-saal.ts` für `e3-flicks-hilfe` | Technik | Globale Karten-IDs |
| Lia geht selbst den Läufer hinauf (ein Paladin folgt ihr, drängt bei Trödeln); auf dem langen Tisch liest sie Listen von Höfen mit Zahlen, eine Zahl durchgestrichen und größer überschrieben | Spieldesign | Kleiner spielbarer Anlauf; zeigt, dass der Großmeister in Zahlen denkt (Vorbereitung auf `e3-falscher-glaube`) |
| Verhör: Ignatius bleibt beim Händler; Lias Tonwahl `e3-verhoer-ton` = `schweigen` / `luege` / `wut`, je eine eigene Antwort des Großmeisters; der Ausgang ist gleich (getrennt befragen) | Spieldesign | umsetzung.md §3; Film F3 08:42–09:32 als Beat |
| Sich losreißen: `storyAction('reach', 'Sich losreißen')` mit Nahbild aus dem Saal (Lia, Paladin). Nach der Geste ist der Arm einen Atemzug frei, dann packt ein zweiter Paladin zu, der Griff wird härter | Spieldesign | „Sie schafft es nicht“ ohne Fehlerzustand; Story-Aktionen kennen kein Scheitern |
| Die Urmacht antwortet geskriptet: Herzschlag, türkiser Blitz und Stoß, alle Paladine taumeln zurück und gehen zu Boden, die acht Kerzen verlöschen nacheinander mit Rauch, der Saal wird dämmrig; Tafel `e3-schutzreaktion`; Lia bricht zusammen. Keine Fähigkeit wird gelernt, niemand stirbt | Spieldesign | Handoff: Schutzreaktion ist keine spammbare Fläche; DESIGN §7.1 „zeigt sich in größter Gefahr“ |
| Danach Schwarz und nur Stimmen: Hauptmann (niemand verletzt), Ignatius gibt die Tarnung auf („Ignatius von Ignis“, Rat der Zehn), der Großmeister will sie hinter den Mauern behalten (wegen der Dunkelschatten), Ignatius: die Urmacht wehrt sich, wenn man sie in die Enge treibt, für sich und die Trägerin („Tür, die zuschlägt“); der Doktor wird geholt; Ignatius soll gehen, will bleiben, „das bin ich ihr schuldig“, gibt nach | Adaption | Film F3 09:57–10:54; Wortlaut neu. „Schuldig“ deutet seine Schuld an, ohne Gwynn zu nennen |
| Der Großmeister kennt Ignatius vom Hörensagen („im Wald verrottet“) | Adaption | Bereitet den Vorwurf der Flucht in die Wälder in `e3-falscher-glaube` vor |

### e3-macht-und-schutz – „Untersuchung und Verhandlung“ (`teil-3/macht-und-schutz.ts`, Regeln `macht-und-schutz-regeln.ts`, Haus `ordenshaus.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: Untersuchung und Verhandlung (Karte `e3-gastzimmer-pruefung`) und `{ part: 'haus' }` (nur mit `e3-ms-frei`, gesetzt nach dem Lösen der Fesseln). Ein Neuladen startet den laufenden Abschnitt neu | Struktur | Reload-Regel; die Fesseln werden nicht zweimal gelöst |
| Gemeinsames Hausmodul `ordenshaus.ts`: Geometrie von `e3-gastzimmer` und `e3-ordenshaus`, Tages- und Nachtfelder, Nachtlichter, die zwei Nachtwachen. Eigene Karten-IDs je Szene (`-pruefung`, `-tag`, `-nacht`), alle `resetOnEnter` | Technik | Globale Karten-IDs; `e3-kyras-fluchtweg` kann `gastzimmerBase(true)` mitbenutzen |
| Die Gästezimmer liegen am unteren Gang, den die Treppe vom Flur erreicht; Lia geht am Treppenfuß über den unteren Sims zum Gang | Abweichung | Der gemalte Grundriss zeigt keine andere Verbindung zwischen Flur und den beiden Zimmertüren |
| Drei Instrumente, jedes mit eigener Eingabe: Kristall (`storyAction('reach')` mit Nahbild des Zimmers) bleibt dunkel; Wasserschale (geduckt am Waschtisch still halten, jede Bewegung kostet Fortschritt) springt dem Doktor ins Gesicht; Kerze (dem Doktor durchs Zimmer folgen, nah an der Flamme bleiben) schießt hoch und neigt sich zu Lia, kurz türkis. Ergebnis: starke Magie, Urmacht nicht nachweisbar, nichts zum Vergleichen | Spieldesign | umsetzung.md §3 („zu stark oder gar nicht“); Film F3 11:29–12:46 als Beat, Wortlaut neu |
| Der Kristall ist kein gemaltes Objekt: ein kalter, pulsierender Lichtpunkt auf dem Tisch; die Kerze in der Hand des Doktors ist ein mitwanderndes Flammenlicht | Darstellung | Keine neue Requisite; Code zeichnet nur Licht |
| Verhandlung: „ein paar Leben gegen Tausende“ als Rechnung des Großmeisters; Lias Antwort in drei Tonlagen (`e3-verhandlung-ton` kalt / bittend / klug), jede mit derselben Behauptung (ohne ihr Ja keine Kraft, Zwang habe er im Saal gesehen). Gleicher Ausgang: Fesseln ab, Stäbe bleiben in der Waffenkammer, Lia bleibt | Spieldesign | umsetzung.md §3; die Zustimmungsschranke bleibt Lias Behauptung (wird später durch das Reliktwissen angegriffen) |
| Der Paladin verrät auf Nachfrage (drei Wortlaute), Ignatius schlafe gleich nebenan; der Großmeister wolle sie getrennt halten, „damit ihr euch keine gemeinsame Geschichte zurechtlegt“ | Adaption | F3 13:39–13:55 als Beat |
| Ordenshaus bei Tag: Waffenkammer (Kamera schaut über die Mauer, der helle Stab hängt sichtbar zwischen den Waffen, nur solange `staffPlace() === 'waffenkammer'`; Hinweis `e3-stab-gesehen`), Chronik in der Bibliothek (`e3-lore-aros`), Kapelle, Ignatius’ Tür mit Wache (keine Besuche), Arbeitszimmertür, Wache am Flurende. Pflicht: zurück ins Bett | Spieldesign | umsetzung.md §3 Teil 2 |
| Der „junge Paladin am Brunnen“ steht als Novize am Wasserkrug im Flur; er erzählt von der Lampe des Doktors und den langen Nächten des Großmeisters im Arbeitszimmer | Abweichung | Das gemalte Obergeschoss hat keinen Brunnen; die Hinweise bereiten `e3-falscher-glaube` vor |
| Das Kapellenfenster ist buntes Glas ohne Bild; der Wissenstext `e3-lore-aros` ist entsprechend angepasst (kein Adler im Glas) | Abweichung | Gemalter Hintergrund (Asset-Lane: keine realen religiösen Symbole) |

### e3-falscher-glaube – „Falscher Glaube“ (`teil-3/falscher-glaube.ts`, Texte `falscher-glaube-gespraech.ts`, Buch `falscher-glaube-buch.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: das gerahmte „Weit entfernt …“ (Tafel `e2-sehkugel`, dann Vamirs Halle `e3-halle-kugel`) und `{ part: 'nacht' }` (nur mit `e3-fg-kugel`) | Struktur | Reload-Regel; das Zwischenspiel wiederholt sich nicht |
| Vamir sieht den Funken nach dem Ausbruch im Saal („laut genug“), schickt die gebannte Kyra nach Trapas: „sei lieb zu ihr, so, wie eine Schwester eben ist“. Keine Technik, kein Gift, kein Plan genannt | Adaption | F3 14:00 („gefunden“) als Beat; Gift und Falle gehören `e3-vertraute-schwester` |
| Violetter Nachschein am Fenster des Zimmers, der verlischt; Lia hält ihn für einen Traum | Darstellung | umsetzung.md §3 („unerklärt“) |
| Lia sucht zuerst Ignatius: sein Zimmer ist leer, das Bett unberührt. Danach die Lampe in der Bibliothek, dann die Stimmen | Spieldesign | Motiv für den Gang durchs Haus; Reihenfolge Bibliothek → Arbeitszimmer wie umsetzung.md |
| Zwei Paladine mit Laternen (Flur: Osttür → Alkoven → Flurmitte; Treppe: oben → unterer Gang). Schatten als Verstecke (geduckt unsichtbar); entdeckt → zurück zum letzten Kontrollpunkt (Zimmertür, Bibliothek, Treppenfuß, Alkoven), kein Game Over | Spieldesign | umsetzung.md §3, Schleichregeln wie Teil II |
| Das Buch des Doktors als gezeichnete Tafel ohne Titel und ohne lesbare Schrift; Lia wählt drei Stellen: Schöpfung („machte zehn, die mit ihr reden sollten“), „was den Ersten gehörte“ (verwischt, daneben ein Kreis aus zehn frischen Strichen), eine herausgeschnittene Seite mit „Freiwillig?“ am Rand | Adaption | Keine Reliktliste, kein Rezept, kein Buchtitel (Szenenplan); das „Freiwillig?“ verweist auf den Weg ohne ihren Willen (F3 37:20) |
| Lauschen in drei Abschnitten an der Tür; dazwischen kommt die Flurwache durch die Osttür, leuchtet in den Alkoven und geht weiter. Lia muss sich in den Schatten neben der Tür ducken; ein neuer Abschnitt beginnt erst, wenn sie wieder an der Tür steht und die Laterne weit weg ist | Spieldesign | umsetzung.md §3 |
| Gesprächsinhalt neu geschrieben: (1) Licht des Aros in jedes Dorf, „zum Wohl der Menschen“ – Ignatius: „ein Knüppel mit Kerze dran“; (2) „keine Göttin, die man ausleert“, „dann stirbt ein Mädchen, und Tausende leben“, Flucht in den Wald nach Dunkelhain; (3) Gwynn, und Ignatius’ Angebot: „Lasst mich Gwynn holen. Danach gehört das Mädchen Euch.“ Abgelehnt, Drohung mit den Richtern des Ordens wegen Fahnenflucht | Adaption | F3 17:30–19:56 als Beats; kein Filmsatz übernommen, der Handel unmissverständlich |
| Hinweis `e3-hinweis-gwynn` und Wissen `e3-lore-glaube` direkt nach dem dritten Abschnitt; `e3-gelauscht` erst am Szenenende | Struktur | Rückmeldung im Moment des Hörens; Abschlussflag am Ende |
| Ignatius kommt heraus, Lia duckt sich in den Schatten; er sagt nur „Gwynn“ vor sich hin und geht durch die Osttür. Rückweg ins Zimmer an beiden Wachen vorbei; Lia ahnt nicht, dass Kyra kommt | Spieldesign | Rückweg „Wache ausweichen“ (umsetzung.md); Übergang zu `e3-kyras-fluchtweg` |

### e3-kyras-fluchtweg – „Durch den Schacht“ (`teil-3/kyras-fluchtweg.ts`, Orte `kyras-fluchtweg-keller.ts`, Texte `kyras-fluchtweg-bericht.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: Zimmer (Karte `e3-gastzimmer-flucht` aus `gastzimmerBase(true)`) und `{ part: 'keller' }` (nur mit `e3-kf-raus`). Ein Neuladen startet den laufenden Abschnitt neu | Struktur | Reload-Regel; Wiedersehen und Stabgespräch wiederholen sich nicht nach dem Aufbruch |
| Kyra sitzt im Mondlicht auf dem Hocker am Tisch; Lia liegt wach, weil ihr Ignatius’ Handel nicht aus dem Kopf geht. Kyra weicht jeder Frage aus („Erzähl ich dir draußen“), auch im freien Gespräch vor dem Umziehen | Adaption | F3 20:07–20:22 als Beat, Wortlaut neu |
| Das Fläschchen: Lia stellt sich zum Umziehen ans Fenster (Rücken zur Kamera), die Kamera schwenkt zu Kyra am Tisch, ein kurzes Glitzern an den Sachen des Doktors, dann Tafel `e3-phiole` („Hinter Lias Rücken“). Kein Erzähler, kein Kommentar, Lia sieht nichts | Spieldesign | umsetzung.md §3: nur der Spieler sieht es; der Doktor hatte seine Instrumente in Lias Zimmer (`e3-macht-und-schutz`) |
| Der Stab: Lia will ihn holen, Kyra nennt Wachen und Schloss; drei Antworten, alle geben nach (`e3-kf-stab-ton` vorerst / schwer / mutter), `e3-stab-zurueckgelassen`. Das Gespräch findet nur statt, solange der Stab wirklich in der Waffenkammer hängt (`staffTalkNeeded`) | Spieldesign | Inventar bleibt die Wahrheit; der Stab bleibt an seinem Ort |
| Lia lässt Ignatius bewusst zurück („Er hat heute Nacht seine Wahl getroffen“) | Adaption | Folgt aus dem Gelauschten in `e3-falscher-glaube`; der Film zeigt keinen Abschied |
| Keller und Kanal sind zwei Karten auf demselben Hintergrund (`e3-keller-gewoelbe`, `e3-keller-kanal`): zwischen Gewölbe und Kanal steht eine Mauer, der Brunnenschacht ist der Weg nach unten | Technik | Keine begehbare Verbindung im Bild; die Kartenprüfung verlangt erreichbare Starts |
| Kellerweg: Kyra kauert immer einen Schatten voraus (Kisten, Fässer, Brunnenrand), eine Paladinwache mit Laterne geht an der Ostseite auf und ab und schaut an beiden Enden nach Westen. Entdeckt → zurück zum zuletzt erreichten Schatten, Kyra zischt einen Hinweis, kein Game Over | Spieldesign | umsetzung.md §3 („Begleiterin führt, Lia steuert“); Schleichregeln wie Teil II |
| Die schmale Treppe ins Gewölbe liegt zwischen dem blauen Pfeiler und der niedrigen Mauer (gemessen auf dem Bild, nicht nach der groben Asset-Notiz) | Technik | Vermessung mit 10-px-Raster |
| Schacht: `storyAction('reach', 'Die Steigeisen hinunter')` mit Nahbild des Brunnens (Lia am Rand, Glanz auf den Sprossen) statt der Buch-1-Illustration | Spieldesign | umsetzung.md §3 |
| Wassergang: ganz `shallow` (langsam), Lia friert in Barks, Kyra watet mit einer kleinen Laterne voraus (Code-Licht folgt ihr) und wartet, bis Lia aufschließt. Tafel `e3-schacht` beim Einstieg | Spieldesign | umsetzung.md §3; Tafel aus der Asset-Lane |
| Das Gitter ist nicht gemalt: Der Hotspot liegt auf der dunklen Öffnung zwischen den Pfeilern; der Erzähler sagt nur, dass es aufschwingt. Lia sieht blank geschabte Bolzen, Kyra: „Irgendwie musste ich ja reinkommen.“ – „Ich schreie nicht mehr.“ | Abweichung | Kein Gitter im Hintergrund, Code zeichnet keine Requisiten; der Hinweis auf Kyras Ortskenntnis bleibt erhalten |
| Kyras Bericht am Ufer: drei Fragen in freier Reihenfolge (Flucht, Flick, Elnon; erste Frage in `e3-kf-erste-frage`). Die Elnon-Antwort kommt glatt und ohne Pause, nur das Porträt zeigt kurz `e2-kyra-gebannt` `cold` (Spielerwissen: Elnon ist tot). Kyra fragt nichts zurück, verschiebt Lias Erzählung „auf morgen am Feuer“. Kein Erzählerkommentar | Adaption | Quellenprüfung §1.7; umsetzung.md §3; Teil II zeigt Elnons Tod |
| Lia erfährt hier erst, dass Flick frei ist; Kyra deutet an, ihr könne unterwegs etwas zugestoßen sein | Kanon | Teil II: Lia wusste nichts von Flicks Flucht; F3 23:13 als Beat |
| Hinweis `e3-kyras-bericht` („Kyras Bericht (unbestätigt)“) nach dem Gespräch, `e3-geflohen` direkt vor dem Übergang | Struktur | umsetzung.md §2 |

### e3-waldgegner – „Rohes Fleisch“ (`teil-3/waldgegner.ts`, Lager und Regeln `waldgegner-lager.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Gerahmtes Zwischenspiel „Unterdessen, ein paar Täler weiter …“, Spielerin ist Flick (`e2-flick-gefangen`); Karte `e3-ghulwald` auf dem wiederverwendeten Hintergrund `k5-faehrte` (nur Nordostteil: Lichtung mit Feuerring, Pfad bis zur Gabelung und nach Westen) | Struktur | umsetzung.md §3; assets.md (Wiederverwendung) |
| Drei Leichenfresser (`ghoul`) streiten um eine Hasenkeule und darum, wann ihre Gefangene „dran“ ist; Gewalt nur als Drohung (Vorrat, Spieß), kein Kampf im Film, kein „Elfenfleisch“-Wortlaut. Einer heißt „Ratze“ | Adaption | Quellenprüfung §1.8 (F3 23:37–24:45); Wortlaut neu |
| Brücke: Flick war zwei Tage frei, dann ein Netz zwischen zwei Buchen; die rechte Hand ist seit dem Verhör noch unbrauchbar, sie arbeitet mit der linken | Adaption | Anschluss an Teil II (Fingernägel, Flucht) |
| Flick steht mit dem Rücken an einem Pflock (Requisit `iso-stake-0`) neben den Wurzeln der großen Eiche, der Stein liegt vor ihren Füßen; festgehalten über `pinPlayer` aus Teil II (Interaktion möglich, Gehen nicht). Stehend, weil die Sitzpose im Dämmerlicht kaum zu erkennen ist | Technik | Keine neue Requisite; Teil-II-Helfer nur gelesen |
| Herzstück 1: `storyAction('tend', 'Den Strick am Stein reiben')` mit Nahbild (Flick, Feuer, Leichenfresser), zweimal. Erlaubt nur, solange keiner herschaut: fester Blickzyklus (`WATCH_CYCLE`), der Hinschauende dreht sich zu Flick, Barks auf beiden Seiten sagen, wer guckt. Versuch beim Hinschauen → „Nicht jetzt“, kein Fehlerzustand | Spieldesign | umsetzung.md §3 („nur wenn keiner hersieht (Bark-Hinweise)“) |
| Zwischen den beiden Reibegängen schickt der Anführer Ratze zum Nachziehen des Knotens; der Streit um die Keule ruft ihn auf halbem Weg zurück, er vergisst es | Adaption | Film: Ratze sollte fesseln und vergaß es (F3 24:36) |
| Herzstück 2: Die Figuren am Feuer werden zu Wachen derselben Stelle (Anführer dreht sich, der Lange schaut nach Osten und Süden, Ratze holt Holz den Pfad hinunter). Drei Farnbüsche am Pfad sind Verstecke und Kontrollpunkte; entdeckt → zurück zum letzten Farn | Spieldesign | umsetzung.md §3; Schleichregeln wie Teil II |
| Leichenfresser ohne gemaltes Porträt: Die Dialogbox zeigt die neutrale Silhouette | Darstellung | ui-guide: der Leichenfresser hat kein Porträt; keine neue Kunst in dieser Stufe |
| Am Ende hört man vom Feuer, wie der Anführer den leeren Pflock entdeckt und Ratze hinterherschickt (Kamera bleibt bei Flick). Flick weiß nicht, wo Lia ist. `e3-flick-ghule` | Adaption | F3 24:36–24:45; Wissen getrennt |

### e3-vertraute-schwester – „Ein Becher Tee“ (`teil-3/vertraute-schwester.ts`, Texte `vertraute-schwester-abend.ts`, Ort `vertraute-schwester-rast.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Drei Abschnitte mit Speicherpunkt: Abend (Standard), `{ part: 'halle' }` (nur mit `e3-vergiftet`), `{ part: 'morgen' }` (nur mit `e3-gift-plan`) | Struktur | Reload-Regel; das Gift wird nicht zweimal getrunken |
| Karte `e3-waldrast` auf dem wiederverwendeten Nachtbild `k3-leselager`; der begehbare Umriss ist der aus Kapitel III (kopiert, nicht importiert), Plätze neu | Technik | assets.md; Teil III lädt Kapitel III nicht |
| Lager aufschlagen: Lia sammelt drei Bündel trockenes Holz (Requisit `twigs`), Kyra macht beim ersten Funken Feuer | Spieldesign | Spielbarer Einstieg in den Abend |
| Lia erzählt in Themen (Ignatius, Valentus und der Stab, Trapas und die Paladine, das Gelauschte), mindestens zwei, dann darf sie aufhören. Kyra hört nur bei Trapas genau hin: sie steht auf, fragt nach der Zahl der Paladine, ob sie ausziehen und ob sie wissen, wohin die Schwestern gingen (`e3-vs-trapas-erzaehlt`) | Adaption | umsetzung.md §3; Vorbereitung auf Vamirs Satz über die Paladine |
| Beim Gelauschten bestärkt Kyra die Trennung („gut, dass du weg bist. Von allen.“) | Adaption | Kyras Auftrag, ohne freie Gier |
| Der Tee: `storyAction('lift')` mit Nahbild des Feuers (Lia, Kyra, Glanz am Becher) statt der Buch-1-Illustration, dann Tafel `e3-gift`; `e3-vergiftet` wird beim Trinken gesetzt. Lia schmeckt es bitter („Mutter hätte Honig reingetan“), ahnt nichts | Spieldesign | umsetzung.md §2 Gift; keine benannte Giftpflanze, keine Dosis |
| Lias Bemerkung über Kyras Schweigen ist neu formuliert („Früher hast du mich nie ausreden lassen“), Kyra: „Lass es. Bitte.“ | Adaption | Szenenbeat ohne Filmwortlaut |
| Schnitt in Vamirs Halle (`e3-halle-plan`): Gift tötet jeden anderen, bei ihr lässt das Licht nur die Schwäche zu; Kyra führt sie in ein Lager „weit draußen“, Baris wartet dort („diesmal packst du die Richtige“); ein „Ohr in ihrem Haus“, der Orden sucht seinen entlaufenen Gast. Kein Name des Spions | Adaption | Quellenprüfung §1.12, F3 27:10–28:07; der Doktor wird erst in `e3-hoffnung-und-weigerung` enthüllt |
| Morgen: harter Weckruf (Porträt kurz `e2-kyra-gebannt` `cold`), `storyAction('open-eyes')`. Danach Gangart `liaGait()` (vergiftet 60 % des Engine-Gehtempos, Rennen gedrosselt), alle paar Sekunden Gehen ein Taumeln (kurzer Halt, Pose `hurt`, Bark). Wer die Tinktur hat, kann sie versuchen: dieselbe Wirkungslosigkeit wie die Taschenaktion | Spieldesign | umsetzung.md §2 Gift (langsameres Gehen, Taumel-Barks, Tinktur wirkt nicht) |
| Der kurze Weg zum Lager endet am Pfad aus dem Dickicht; der eigentliche Weg liegt zwischen den Szenen | Spieldesign | Die Falle hat ihre eigene Karte (`e3-falsches-lager`) |

### e3-falle – „Die Falle“ (`teil-3/falle.ts`, Lager und Regeln `falle-lager.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Ein Abschnitt, Karte `e3-falsches-lager` (grauer Vormittag, keine Musik, nur Wind und Feuer, keine Vögel); ein Neuladen beginnt unten am Pfad. Die Lagergeometrie liegt in `falle-lager.ts` und wird von den beiden späteren Besuchen derselben Lichtung mitbenutzt | Struktur | Reload-Regel; ein gemaltes Lager für drei Szenen |
| Lia ist vergiftet: `liaGait()` (60 % des Engine-Gehtempos), Taumeln beim Gehen (Barks aus `vertraute-schwester-abend.ts`), und auch das Rennen ist gedrosselt (sonst hebelt Shift das Gift aus) | Spieldesign | umsetzung.md §2 Gift |
| Herzstück: drei Funde in beliebiger Reihenfolge. Mit Spurenblick: Stiefelabdrücke mit Nagelmuster vor dem Ostzelt, ein schwarz-weißer Stofffetzen an der Palisade. Direkt: „Unter die Plane sehen“ am Käfigwagen. Jeder Fund ist ein Tagebuchhinweis (`e3-falle-stiefel`, `-fetzen`, `-kaefig`); Lias Gedanke wird mit jedem Fund klarer (1: keine Jägerstiefel, 2: Leute, die jemanden erwarten, 3: „ein Lager für mich“), Zählstand `e3-falle-hinweise` (0–3) bleibt erhalten | Spieldesign | umsetzung.md §3 |
| Kyra wartet am Feuer, ruft Lia regelmäßig her und wischt die ersten beiden Funde beiseite („Rebellen tragen, was sie den Dunkelschatten abnehmen“, „Du siehst Gespenster“). Zwei Zelte lassen sich ansehen (unbenutzte Decken, kein Krümel), ohne zu zählen | Adaption | Kyra drängt, ohne eigene Gier; Stimmung „leeres Lager“ |
| Die Falle schnappt beim dritten Fund, beim Hinsetzen ans Feuer oder beim Ansprechen Kyras zu. Kurzer Schnitt ans Feuer; Lias letzte Worte hängen vom Zählstand ab (0: „Endlich sitzen“, 1–2: „irgendwas stimmt hier nicht“, 3: „kein Rebellenlager, wir müssen weg“) | Spieldesign | Frühe Hinweise verändern Reaktion und Tagebuch, nicht den Hauptbogen (Szenenplan) |
| Kyra ruft die Männer mit fremder, flacher Stimme (Porträt `e2-kyra-gebannt` `cold`); zwei Schergen brechen aus dem Gebüsch, Baris kommt hinter dem Ostzelt hervor. Tafel `e3-falle`. Filmsatz „Kyra, wie konntest du?“ ersetzt durch „Du hast mich hergebracht … Du hast es gewusst.“; Kyras Antwort neu („Der Meister wollte dich haben. Also habe ich dich gebracht.“) | Adaption | Kein Filmwortlaut; Gehorsam, keine freie Abkehr |
| Lia sieht das violette Glimmen in Kyras Augen („Das ist nicht Kyra. Nicht ganz.“) – Grundlage dafür, dass sie in der zweiten inneren Szene von Vamirs Einfluss spricht | Adaption | Film 35:40 (Lia weiß später vom Einfluss) |
| Baris: „Diesmal die Richtige … mit dem Auge, das mir geblieben ist“ (Rückgriff auf Vamirs Tadel aus Buch 1). Vamir tritt hinter dem Feuer aus Rauch und kaltem violettem Licht, Gesicht unter der Kapuze; Lias Weigerung und Vamirs Antwort neu formuliert | Adaption | Kein Filmwortlaut (F3 30:00–30:20) |
| Die Schergen packen Lia hart: ein Schlag mit dunkelrotem Aufblitzen, Kamerastoß, Trefferton und drei Tropfen von einer aufgeplatzten Lippe (`common/blood.ts` `bloodHit`, Stärke 0,4). Kein weiteres Blut, keine Misshandlung | Spieldesign | umsetzung.md, Vorrang (1): sichtbarer Treffer, kein Selbstzweck |
| Letzte Geste: `storyAction('reach', 'Nach Kyras Hand greifen')` mit Nahbild; Kyra tritt einen Schritt zurück. Danach Look `e3-lia-gefesselt`, die Schergen ziehen sie zum Käfig, Abblende | Spieldesign | Packen, Kamera, Pose |
| Abschluss `e3-gefangen` | Vertrag | umsetzung.md §2 |

### e3-innere-zuflucht – „Die innere Zuflucht“ (`teil-3/innere-zuflucht.ts`, Ort und Texte `innere-zuflucht-welt.ts`, Wirkung `innere-zuflucht-nebel.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: innere Wiese (Standard), `{ part: 'lager' }` nur mit `e3-zf-erinnert` | Struktur | Reload-Regel |
| Karte `e3-innenwelt` ohne Ortsnamen-Toast, ohne Musik (erst am Ende leise `refuge`), Wind fast stumm, dafür ein langsamer, gedämpfter Herzschlag (`G.audio.loop('heartbeat', { distance })`). Bildschirmränder: atmende lavendelgraue Vignette und weiche Nebelschwaden (Overlay-Kamera); dichter Nebel über den noch nicht erinnerten Teilen der Wiese. Ziel nur als Text, ohne Zielmarke. Look `e3-lia-innen`, Porträt `lia` | Darstellung | Handoff: deutlich erkennbare Bewusstseinsebene, kein Reiseort |
| Lavendel, Grau und warmes Weiß, nie Türkis (Urmacht/Valentus) und nie Violett (Vamir) | Farbe | umsetzung.md §1 Farben |
| Herzstück: drei helle Stellen im Nebel, beliebige Reihenfolge. Buch unter der Eiche (*Die Geschichten der Magierin Alana*, Requisit `alana-book`), Kyra mit Feuerholz (blasse Erinnerungsfigur `kyra`, Requisit `twigs`), Mutter bringt Lia das Lesen bei (Erinnerungsfigur `mother`, kniend). Erinnerungsfiguren warm getönt und halb durchscheinend; nach jeder Erinnerung hebt sich der Nebel dieses Teils, die Wiese wird größer | Spieldesign | umsetzung.md §3 |
| Die Mutter stammt aus Trapas („Ich war gerade dort, Mutter.“) | Kanon | DESIGN.md §7, Quellenprüfung §1.1 |
| Nach der ersten und zweiten Erinnerung dringen gedämpfte Stimmen von Vamirs Männern am Käfig herein: eigenes transparentes Textfeld oben („Von draußen, gedämpft“), verwischte Zeilen, tiefes Murmeln statt Dialog-Blips, kein Bild, kein Name; Ränder ziehen sich dabei zu, der Herzschlag wird schneller. Lia begreift: draußen, und hier drin kommt nichts an | Spieldesign | „Stimmen von außen, ohne Bild“ |
| Zum Schluss setzt sich Lia unter die Eiche (Pose `sit`); ihr Gedanke bleibt bei sich („noch nie ein Buch mitten auf der Seite liegen lassen“), keine Lebensweisheit | Adaption | Keine pathetischen Sinnsprüche |
| Schnitt „Unterdessen, im Lager …“ (Karte `e3-falsches-lager-sieg`, Dämmerung, Spielerfigur Vamir festgehalten): Vamirs Siegesrede, Lob für Kyra (sie antwortet ergeben, „Ich tue, was Ihr sagt.“; Filmwort „meine Kleine“ ersetzt), Baris am Pfosten bei Flick: Sie ist ihnen einen halben Tag nachgeschlichen und wurde gefasst; Baris will töten, Vamir: zusehen lassen, dann den Wölfen überlassen; Baris' Spott neu formuliert („Du warst doch immer am liebsten allein …“) | Adaption | Quellenprüfung §1.9 (F3 31:01–32:18), Wortlaut neu |
| Baris verrät dabei, dass die Paladine in Trapas „noch ihr Gästezimmer absuchen“ – so weiß Flick, wo sie Hilfe findet | Adaption | Brücke zu `e3-flicks-hilfe` (Flick handelt selbst) |
| Der Wagen bleibt im Schnitt stehen („Sobald es dunkel ist, fahren wir.“); Lia liegt unter der Plane | Technik | Der Käfigwagen ist ins Bild gemalt; sein Abfahren zeigt erst die Nachtkarte |
| Abschluss `e3-zuflucht-1` am Ende des Schnitts | Vertrag | umsetzung.md §2 |

### e3-flicks-hilfe – „Flicks Nachricht“ (`teil-3/flicks-hilfe.ts`, Orte und Regeln `flicks-hilfe-wege.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: verlassenes Lager (Standard, „Unterdessen, im verlassenen Lager …“), `{ part: 'saal' }` nur mit `e3-fh-frei` („Trapas, kurz vor Mitternacht …“) | Struktur | Reload-Regel; gerahmtes Zwischenspiel |
| Zeitleiste im Saal: Lia ist „vorletzte Nacht“ verschwunden, die Reiter suchen „seit zwei Tagen“; das Lager liegt „näher, als Ihr denkt“, weil Kyra Lia im Kreis geführt hat (Lia und Kyra brauchten anderthalb Tage, Flick nur den Abend). Am Hügel sind die Paladine die Vorhut, „der Rest ist eine Stunde hinter uns“ | Verbindung | Review: Fluchtnacht → ein Tag Wald → Tee → Falle → Flick am Tor vor Mitternacht |
| Nachtkarte `e3-falsches-lager-nacht`: Der Wagen ist fort. Kamera und begehbare Fläche enden kurz vor seinem gemalten Standort (Kamera bis x 1000, Boden bis x 975); seine Spur führt nach Osten aus dem Bild | Technik | Der Käfigwagen ist ins Bild gemalt und lässt sich nicht entfernen |
| Herzstück 1: Flick (`e2-flick-gefangen`, festgehalten mit `pinPlayer`) dreht die Hände im Seil, `storyAction('tend')` dreimal mit Nahbild. Dazwischen sammeln sich Wolfsaugen am Rand des Lichts (nur gelbe Augenpaare und Geräusche, nie ein Körper), mehr und näher mit jeder Drehung | Spieldesign | umsetzung.md §3 („nur Augen und Geräusch am Rand“) |
| Kein Heulgeräusch im Klangkatalog: Heulen und Knurren sind tief gestimmtes, fernes `bark-dog` | Technik | Nur vorhandene Effekte |
| Frei (Look `flick`): einen Brand aus der Glut ziehen. Ein mitwanderndes Feuerlicht; die Augen halten mit Brand deutlich mehr Abstand (Regel `keepAway`). Dann Spurenblick: Radspuren und Hufe eines lahmenden Pferdes nach Osten (nur Flicks Gedanke, kein Tagebucheintrag – Lia erfährt davon nichts). Flick entscheidet sich für Trapas, weil sie allein nichts ausrichtet | Spieldesign | umsetzung.md §3; Wissen getrennt |
| Rückzug: Flick geht rückwärts den Pfad hinunter, das Gesicht zum Lager (Blickrichtung festgehalten, Tempo gedrosselt, kein Rennen), die Augen folgen am Rand des Lichts | Spieldesign | „zieht rückwärts zum Weg“ |
| Herzstück 2 im Saal (`e3-ordenssaal-nacht`, Geometrie aus `schutzreaktion-saal.ts`): Der Hauptmann meldet sie, der Großmeister sitzt auf dem Hochstuhl, Ignatius ist geholt worden. Flick berichtet (Pfosten, Käfig, Kyra „als wäre sie gar nicht richtig da“) | Adaption | F3 33:58–34:45, Wortlaut neu |
| Erste Wahl `e3-flick-ton`: Spott / Ehrlichkeit (sie lernte Lia im Regen kennen; Lias Licht rettete sie vor Baris' Axt) / Ignatius ansprechen (er erkennt sie aus Lias Erzählungen: „Leseratte“, die schwache rechte Hand). Zweite Wahl `e3-flick-beweis`: Striemen zeigen / den Weg wie ein Kundschafter beschreiben / die Geduld verlieren. Jede Antwort hat eine eigene Reaktion, alle führen weiter | Spieldesign | umsetzung.md §3 („Wie Flick überzeugt“) |
| Ignatius bürgt immer („mit allem, was Ihr mir noch glaubt – zugegeben nicht viel“); der Großmeister entscheidet aus eigener Abwägung („mehr, als Vamir mir je gegeben hat“) und lässt ausrücken – erster Schritt zur späteren Wende des Ordens | Adaption | Szenenplan: Rettungsbeschluss als erster sichtbarer Schritt |
| Ignatius holt mit Erlaubnis des Großmeisters beide Stäbe aus der Kammer (seinen Schattentöter trägt er selbst) und reicht Flick Lias Stab: `storyAction('reach', 'Den Stab nehmen')`. `e3-stab-ort = 'flick'`; Lias Inventar bleibt unverändert, sie hat den Stab nicht | Vertrag | umsetzung.md §2 Stäbe |
| Abschluss `e3-flick-gemeldet`, `e3-orden-rueckt-aus` direkt vor dem Übergang zu `e3-hoffnung-und-weigerung` | Vertrag | umsetzung.md §2 |

### e3-hoffnung-und-weigerung – „Hoffnung“ (`teil-3/hoffnung-und-weigerung.ts`, Texte und Regeln `hoffnung-und-weigerung-texte.ts`, Wirkung `hoffnung-riss.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Drei Abschnitte mit Speicherpunkt: innere Wiese (Standard), `{ part: 'halle' }` nur mit `e3-hw-innen`, `{ part: 'kontakt' }` nur mit `e3-geweigert` | Struktur | Reload-Regel |
| Zweiter Besuch der Wiese als eigene Karte `e3-innenwelt-riss` (Geometrie aus `innere-zuflucht-welt.ts`): Nebel des ersten Besuchs ist fort, Ränder atmen weiter (`innerFog` ohne Flecken), gedämpfter Herzschlag statt Musik, Ziele nur als Text | Darstellung | Bewusstseinsebene wie beim ersten Besuch |
| Die Gestalt (`e3-gestalt`, per Alpha durchscheinend, nie Türkis) nennt sich nur „ein Teil von dir“; keine Gleichsetzung mit Xenovia oder der Urmacht. Film-Selbstbezeichnung (ASR „Treppen“) nicht übernommen | Neutral | Szenenplan offene Frage 6 |
| Gespräch: Lia zählt in freier Reihenfolge auf, wer ihr bleibt (Kyra gebannt, Flick „geflohen, sagt Kyra“, Ignatius und Gwynn aus dem Lauschen). Die Gestalt antwortet mit Lias eigenen Zweifeln, nicht mit Wissen von draußen; „Hoffnung“ als trockener Wortwechsel über letzte Buchseiten statt Sinnspruch (Filmzeile F3 35:50 ersetzt). Tafel `e3-gestalt` | Adaption | Keine pathetischen Sinnsprüche, Wissen getrennt |
| Herzstück „Nebelriss“: drei violette Risse in der Wiese nacheinander; Lia muss hingehen und still stehen (2,4 s, Regel `riftStep`: Gehen oder Weggehen lässt den Fortschritt schneller zurücklaufen), ein weißer Ruhering zeigt den Fortschritt. Kein Scheitern. Dazwischen gedämpfte Stimmen von draußen (Vamir nur „die kalte Stimme“, ohne Namen). Der vierte Riss reißt überall: violetter, dann weißer Blitz | Spieldesign | umsetzung.md §3 („Nebelriss“); Film F3 35:56–36:35 („Er versucht es mit Magie“) |
| Violett in der inneren Welt nur für Vamirs Risse; die Wiese selbst bleibt Lavendel und Warmweiß | Farbe | umsetzung.md §1 Farben |
| Weigerung in Vamirs Halle (`e3-halle-weigerung`, Geometrie aus Teil II): Lia kniet gefesselt am Bodenring (festgehalten), Augen öffnen per `storyAction`. Drei Antworten, alle verweigern (`e3-weigerung-wort`); Vamir droht mit Schmerz, kein Schmerz wird gezeigt, keine Folter als Mechanik. Filmsätze „Dann werde ich sie mir nehmen“ und „Bares, lass sie ihre Entscheidung bereuen“ ersetzt: Vamir sucht „einen anderen Weg“, Baris unterbricht mit der Ankunft des Mannes aus Trapas | Adaption | F3 36:35–37:03, Wortlaut neu |
| Schnitt „Kurz darauf, in derselben Halle …“ (Spielerwissen, Spielerfigur Vamir): Der Kontaktmann ist der Doktor; er bringt den Weg nicht dem Großmeister, sondern Vamir. Das Buch: Trägerin und zehn Dinge der ersten zehn Menschen an einem Ort, alle auf sie gerichtet. Neu: „Die Seite, auf der stand, was danach aus ihr wird, fehlt“ – Verbindung zur herausgerissenen Seite, die Lia in `e3-falscher-glaube` liest. Keine Reliktnamen. Baris: „Plunder“ aus den Tempeln, kistenweise; der Doktor soll ihn heraussuchen; der Doktor fragt nach seinem Anteil („Du lebst.“). Er ist die eine Nacht durchgeritten (er verließ Trapas in der Nacht, als der Orden ausrückte; vgl. `e3-hueterin`). Der Doktor redet in Mess- und Instrumentenbildern („gerichtet wie Nadeln auf einen Pol“), die Gestalt in Bildern von Schwelle und Schloss, damit kein Satz dem Film folgt. Tafel `e3-relikte` | Verbindung | Quellenprüfung §1.3–4; Handoff: keine Reliktliste |
| `e3-geweigert` am Ende der Halle, `e3-relikte-plan` am Ende des Schnitts | Vertrag | umsetzung.md §2 |

### e3-ritual – „Das Ritual“ (`teil-3/ritual.ts`, Ort, Regeln und Texte `ritual-huegel.ts`, Kreis `ritual-kreis.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: Lia auf dem Stein (Standard), `{ part: 'flick' }` nur mit `e3-ri-lia-gesehen` („Unterdessen, am Waldrand …“) | Struktur | Reload-Regel; Flicks Teil gerahmt |
| Die zehn gemalten Ständer tragen im Code gezeichnete Dinge: zuerst unter Leinentüchern, nach Vamirs Befehl zehn verschiedene namenlose Formen (Horn, Schale, Reif, Steine …). Von jedem läuft ein dünner türkiser Faden zu Lia, darüber wächst die türkise Kugel; Vamirs kaltes Violett daneben. Türkis = die Urmacht, die aus Lia gezogen wird | Darstellung | Keine Reliktnamen; Farbregel umsetzung.md §1 |
| Lia liegt gefesselt auf dem Stein (`e3-lia-gefesselt`, Pose `lie`, festgehalten): Augen öffnen, Antwort an Baris (Wahl; sie erinnert ihn an seinen Flug ins Kornfeld aus Buch 1, ohne von Vamirs Strafe zu wissen), `storyAction('reach', 'Nach Kyra greifen')` mit Nahbild; Kyra sieht durch sie hindurch, Vamir antwortet für sie | Spieldesign | umsetzung.md §3; Wissen getrennt (die Narbe kennt nur der Spieler) |
| Vamirs Rede neu formuliert (Höhlen und Ruinen, die letzten freien Städte knien, Jahre neu zählen); Filmzeilen F3 39:13–39:58 nur als Beat | Adaption | Keine Filmzeilen |
| Flicks Anstieg (Karte `e3-ritualhuegel-anstieg`, gleiche Malerei, Kamera 0,8 weit, damit die Kuppe im Bild bleibt): Flicks Boden endet, wo die Büsche am Hohlweg enden. Drei äußere Wachen sind dunkle Umrisse in der Dämmerung und heben sich nur im Spurenblick und in Sichtweite (260 px) heraus; dann „Posten zeigen“ (Ignatius oder ein Paladin antwortet) | Spieldesign | umsetzung.md §3 („drei Wachen markieren“) |
| Wahl des Anstiegs als Ort statt Menü: drei Stellen am Weg (Hohlweg, Felsen, offen), Ignatius bewertet jede, Flick bestätigt oder sieht sich weiter um. `e3-ritual-weg` steuert nur die Startaufstellung des Kampfs | Spieldesign | umsetzung.md §3 |
| Der erste Pfeil: `storyAction('lift', 'Den Bogen spannen')`, der Speerträger fällt; Baris „Woher kam der?“ – Flick „Von hier unten, Baris.“ statt der Filmzeilen „Wer war das?“ – „Ich!“ | Adaption | F3 40:39–40:41, Wortlaut neu |
| `e3-ritual-begonnen` direkt vor dem Übergang zu `e3-ritualangriff` | Vertrag | umsetzung.md §2 |

### e3-ritualangriff – Szene „Am Stein“ (`teil-3/ritualangriff.ts`; Kampf siehe unten)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte: Kampf (Standard; Niederlage bietet „Erneut versuchen“ im Kampf, ein „Weiter“ nach Niederlage startet ihn neu), `{ part: 'nach' }` nur nach dem Sieg (`e3-ritual-gewonnen`) | Struktur | Reload-Regel |
| Beim Sieg: `staffBack('e3-stab-zurueck')` (doppelt abgesichert, keine zweite Gabe), `e3-kyra-frei`; gemerkt wird, ob der Stab schon im Kampf übergeben wurde (`e3-ra-stab-im-kampf`) | Vertrag | umsetzung.md §2 Stäbe |
| Nach dem Kampf auf der Kuppe (`e3-ritualhuegel-danach`, Dämmerung, Rauch, die Dinge auf den Ständern dunkel): Lia (eigener Stab, vergiftet langsam) geht zu Kyra. Kyra „Ist es vorbei?“, Löcher in der Erinnerung, ein Schwert in der Hand, das sie nicht erklären kann (Elnon wird nicht genannt). Lias Antwort als Wahl; Kyra braucht Raum („wo ich aufhöre und wo er angefangen hat“), kein Jubel | Adaption | Szenenplan: Schwesterbindung braucht Raum; Elnons Tod erfährt Lia erst im Epilog |
| Flick: Tafel `e3-stabrueckgabe` nur, wenn der Stab im Kampf nicht übergeben wurde, sonst eine kurze Nachfrage. „Hier, kleine Zauberin“ (F3 42:12) ersetzt („Bevor ich’s vergesse, Zauberin. Der gehört dir.“) | Adaption | Keine Doppelung der Tafel; Wortlaut neu |
| Aufteilen: Flick bleibt bei Kyra, die Paladine suchen den Nordhang, Lia folgt allein Ignatius’ Spur nach Osten (Spurenblick: kalte Asche, wo Vamir verschwand, Stiefel, ein bernsteinfarbener Brandfleck, abgeknickte Zweige). Lias Grund: Sie will ihn noch etwas fragen | Adaption | Film F3 42:17–42:24; führt zu `e3-vamir` (Lia allein) und zum Verzeihen |
| Optional die Dinge auf den Ständern ansehen (Wissen `e3-lore-relikte`, sonst am Szenenende); ein Paladin verbietet das Anfassen, der Großmeister entscheide darüber. Verbleib bleibt offen | Neutral | Handoff: Verbleib der Relikte offen |
| `e3-ritual-gebrochen` und `e3-lore-relikte` am Szenenende, direkt vor `nextScene('e3-vamir')` | Vertrag | umsetzung.md §2 |

### e3-ritualangriff – Taktikkampf „Am Stein“ (`teil-3/ritualangriff-battle.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Ritualladung: +1 je Gegnerrunde, solange Lia gefesselt ist und ein Ständer steht; bei 8 Niederlage („Das Ritual hat Lia fast leer gezogen“, Erneut versuchen) | Spieldesign | Film zeigt nur die wachsende türkise Kugel (F3 40:14); die Leiste macht die Bedrohung spielbar (umsetzung.md §3) |
| Zehn Holzständer im Kreis um den Stein, ohne Namen der Gegenstände. Wer neben einem steht, kann ihn umstoßen: Ladung −1, das Feld wird danach begehbar | Spieldesign | Keine Reliktnamen (Handoff); das Umstoßen öffnet zugleich einen Weg in den Kreis, sonst sperren zwei Wachen jede Lücke |
| Lia wird von Flick befreit oder vom vorderen Paladin, der sich von selbst zum Stein durchkämpft | Spieldesign | umsetzung.md: „Flick oder ein Paladin neben dem Stein“ |
| Vamirs Leute verletzen Lia nicht (sie wollen sie ganz); vergiftet 60 % LP/MP | Kanon / Spieldesign | Vamirs Plan (Quellenprüfung §1.12); Giftregel umsetzung.md §2 |
| Lia kommt aus `common/liaKit` (`liaUnit('e3-ritualangriff', …)`, Stufe ≥ 7, Budget 30 EXP/8 AP, Stufengrenze 8): Angriff Vaters Dolch, Eigenschaft Verzweiflung, Spezialaktionen nach Kampagnenstand; Stabstrahl nur mit eigenem Stab (über `extra` angehängt), Stabimpuls nur mit Schattentöter. Gift als `hpFraction` 0,6 plus Kappung der Maxima in `onStart` (`applyPoison`, abgerundet), damit Versorgen das Gift nicht aufhebt | Spieldesign | DESIGN §7 Prinzip 4 (Lia kämpft seit dem Tod der Eltern, Dolch zuerst); Giftregel umsetzung.md §2 |
| FFTA-Regeln: Ignatius schützt nur (`attack: false`, Bernsteinwall), die befreite Kyra auch (`attack: false`, nur Schubsen); alle anderen haben ihren Grundangriff (Bogen, Schwerthieb, Axthieb, Speer, Bolzen). Der einmalige Dolch-Hinweis (`liaCombatHint`) kommt erst, wenn Lia frei ist | Spieldesign | tactics-guide.md (Grundangriff, `attack: false`) |
| Blut, wo der Kampf hinsieht: Baris’ Fall (dunkelrotes Aufblitzen, Tropfen, Lache unter ihm, Kamerastoß) und fallende Paladine (schwächer). Gebannte Kyra und die Dunkelschatten ohne Blut | Spieldesign | umsetzung.md, Vorrang (1); `battle-shared.battleBlood` |
| Stabrückgabe im Kampf, sobald Flick neben der befreiten Lia steht: `e3-stab-zurueck`, + `e3-lia-staff`, Stabstrahl; Tafel `e3-stabrueckgabe` nur, wenn geliefert | Spieldesign | Film F3 42:12 gibt den Stab nach dem Kampf; im Spiel früher, damit Lia mitkämpft. Inventar bleibt die Wahrheit |
| Fällt Baris, bricht im selben Moment Kyras Bann; sie wechselt zu den Verbündeten. Ursache bleibt offen | Adaption | Film koppelt nur zeitlich (F3 41:29–42:02; Szenenplan, offene Frage 7) |
| Kyra kann nicht dauerhaft fallen, gebannt wie befreit: Sie rappelt sich mit 40 % LP wieder auf (befreit weiter ohne Angriff, Seite der Verbündeten). Eine Niederlage durch Kyra gibt es nicht | Spieldesign | umsetzung.md §3 |
| Ist Lia frei, verschwindet Vamir (keine Einheit) in Rauch, Ignatius folgt ihm, zwei Dunkelschatten laufen davon | Adaption | Film: Vamir zieht sich zurück, Ignatius verfolgt ihn (F3 42:20); die Desertion entlastet die zweite Kampfphase |
| Baris (Lvl 8, nonLethal) und gebannte Kyra (Lvl 4) mit eigenem Profil für diesen Kampf | Spieldesign | Das Kampagnenprofil (Hauptmann Lvl 16) wäre für Flick und zwei Paladine nicht zu besiegen; Sieg verlangt Baris’ Fall |
| Anstieg aus `e3-ritual-weg` (`hohlweg`/`felsen`/`offen`, sonst `hohlweg`) ändert nur die Startpositionen | Spieldesign | umsetzung.md §3 e3-ritual |
| EXP/AP nur beim ersten Sieg (`e3-ritual-gewonnen`, danach alle Budgets 0) | Spieldesign | Kein Farmen bei Neustart |

### e3-vamir – Duell „Vamir“ (`teil-3/vamir-duell-battle.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Violetter Schild: Solange er steht, ist Vamirs Rüstung so hoch, dass nur der Stabstrahl (fester Schaden) durchdringt; ein Treffer bricht ihn | Spieldesign | Film: türkiser Stabangriff besiegt Vamir (F3 43:22); Schild macht den eigenen Stab zum Schlüssel |
| Alle zwei Runden springt Vamir an eine andere Stelle (das ist sein Zug) und hebt den Schild neu | Spieldesign | umsetzung.md §3 |
| Nach dem dritten gebrochenen Schild oder unter 30 % LP antwortet die Urmacht: türkiser Ausbruch, Vamir löst sich violett auf (Tafel `e3-vamir-fall`, wenn geliefert). Kein gewöhnlicher Treffer tötet ihn vorher | Spieldesign | Film F3 43:19–43:30; Vamirs Niederlage bleibt persönlich (Handoff) |
| Vamirs Grundangriff ist der Kalte Stoß (5 fester Schaden, 80 %, bis 4 Felder), dazu Schattenranken (3 auf Fläche, 85 %, Abklingzeit 3). Beide `noFlank`: wie Magie zählt die Genauigkeit, nicht die Blickrichtung | Spieldesign | Gleich gefährlich, egal welches Level Lia erreicht hat; unter den FFTA-Regeln träfe ein körperlicher Fernangriff von vorn nur zu 50 % |
| Der Sprung alle zwei Runden ersetzt nur Vamirs Bewegung: Er taucht drei bis vier Felder von Lia entfernt auf (in Reichweite beider) und schlägt im selben Zug zu. Acht Sprungpunkte | Spieldesign | Vorher kostete der Sprung den ganzen Zug; Vamir griff kaum an und das Duell war nach den neuen Regeln ohne Gefahr |
| Lia aus `common/liaKit` (`liaUnit('e3-vamir-duell', …)`, Stufe ≥ 7, Budget 40 EXP/10 AP, Grenze 8), Gift wie im Ritualkampf. Ihr eigener Kampfruf bei 25 % LP, damit er nicht mit dem Verzweiflungsruf (50 %) zusammenfällt. Ignatius `attack: false`; unter ihm breitet sich zu Beginn eine dunkle Lache aus (er wurde im Tableau getroffen) | Spieldesign | DESIGN §7 Prinzip 4; umsetzung.md, Vorrang (1) |
| Ohne eigenen Stab gäbe es keinen Schild (nichts könnte ihn brechen); im regulären Ablauf hat Lia ihn immer | Spieldesign | Regel „Stabstrahl nur mit Stab“ |
| Ignatius liegt kampfunfähig am Wegrand, nicht steuerbar; er sinkt zu Beginn ins Laub | Adaption | Film: Vamir trifft ihn vor dem Duell (F3 42:55–43:06) |
| EXP/AP nur beim ersten Sieg (`e3-duell-gewonnen`) | Spieldesign | Kein Farmen bei Neustart |

### e3-vamir – Szene „Vamir“ (`teil-3/vamir.ts`, Regeln und Texte `vamir-spur.ts`, Ort `waldpfad.ts`, Gang `vamir-schwaeche.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Zwei Abschnitte mit Speicherpunkt: Spur und Tableau (Standard), `{ part: 'duell' }` nur nach dem Tableau (`e3-va-gestellt`); Aufgeben im Kampf startet das Duell neu | Struktur | Reload-Regel |
| Eigene Karte `e3-waldpfad-spur` auf `e3-waldpfad`, später Nachmittag; Figuren etwas größer gezeichnet (`depthScale`), weil das Bild näher gemalt ist | Darstellung | assets.md, Kompromiss (2) |
| Spurenblick auf dem unteren Weg in fester Reihenfolge: Brandfleck mit Reif statt Asche (Vamirs Kälte, kein Feuer), Schattentöter im Weg, Stiefelspuren, die zur Böschung abbiegen. Alle drei liegen so tief, dass die Böschung noch außer Sicht ist | Spieldesign | umsetzung.md §3; Vamir und Ignatius erscheinen erst, wenn Lia sie hört |
| Lia hebt Ignatius’ Schattentöter auf (`e3-schattentoeter-gefunden`, + `e2-schattentoeter`, einmalig). Im Duell gilt damit die Regel „Stabimpuls nur mit Schattentöter“ wie überall; `prepareE3` gibt ihn späteren Direkteinstiegen ebenfalls | Spieldesign | Spur aus umsetzung.md §3; Inventar ist die Wahrheit; Anschluss an die optionale Niederlegung in `e3-hueterin` |
| Stimmen von der Böschung, dann Anschleichen hinter den Busch (Versteck); Tableau: Vamir über dem knienden Ignatius, Ignatius trotzt in eigenen Worten; Lia versucht, den Stab zu heben (`storyAction('lift')`) und ist trotzdem zu spät | Spieldesign | Beat F3 42:45–43:06; Vergiftung macht Lia langsam, die Geste hat keinen Fehlerzustand |
| Vamirs Schlag ist kaltes violettes Licht und trifft hart: violetter Blitz, dann dunkelrotes Aufblitzen mit Kamerastoß, Trefferton und Tropfen (`common/blood.ts` `bloodHit`, Stärke 1); Ignatius sinkt ins Laub, unter ihm breitet sich langsam eine dunkle Lache aus (`bloodPool`). Er stirbt später ruhig und ohne neues Blut (`e3-ignatius-abschied`) | Kanon | umsetzung.md, Vorrang (1) und §1 („der Treffer darf hart wirken“); Farbregel: Magie violett, Blut nur als Folge |
| Vamirs Filmzeilen („Gib endlich auf“, „ins Jenseits begleiten“) und „Na los, dann tu es doch!“ nicht übernommen; Lia ruft „Ignatius!“ statt „Nein!“ | Adaption | Keine Filmzeilen |
| `e3-vamir-besiegt` erst nach dem Sieg, direkt vor `nextScene('e3-ignatius-abschied')` | Vertrag | umsetzung.md §2 |

### e3-ignatius-abschied – „Abschied“ (`teil-3/ignatius-abschied.ts`, Texte `ignatius-abschied-texte.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Eigene Karte `e3-waldpfad-abschied`: Ignatius liegt auf der moosigen Böschung, wo er im Tableau fiel; warmes Abendlicht, über ihm ein schwaches Bernsteinlicht, das mit ihm verlischt | Darstellung | Tafel `e3-abschied`; Bernstein = Ignatius |
| Ein Abschnitt; ein Reload beginnt wieder kurz nach dem Duell (Ignatius lebt). Kein Ausgang ändert den Tod | Struktur | Reload-Regel; Handoff: kein Heilitem verhindert den Tod |
| Mit Tinktur im Gepäck bietet die Szene den Versuch an; Ignatius lehnt sanft ab, die Tinktur wird nicht verbraucht | Spieldesign | umsetzung.md §3 |
| Taschenaktion „Auftragen“ für `tincture` (catalog.ts) gilt global, weil `ui/bag` kein Abmelden kennt: In jedem Kapitel zeigt die Tasche den Knopf, nur vergiftet ist er aktiv. Der Grund beim gesperrten Knopf („Mutters Tinktur. Die hebe ich mir für einen Kratzer auf …“) passt deshalb in jedes Kapitel | Technik | Engine-Lücke (kein `unregisterItemAction`), gemeldet |
| Gespräch mit drei Wahlen: Tinktur oder Hand, Vergebung (direkt, erst nachfragen, erst wütend – alle vergeben, `e3-abschied-ton`), Lias letzte Worte (Gruß an Gwynn, Dank, Schweigen) | Spieldesign | umsetzung.md §3 |
| Neu formuliert: „Händlerstochter“ als Rückgriff auf die Deckgeschichte (er nennt sich nie Vater); Gwynn „lebt nicht mehr, schon lange … verboten, es zu wissen“; der Körper als „abgewetzter Mantel“; Zusehen „von weiter hinten wie ein Lehrer am Ende des Saals“; statt „du bist nie allein“: „wenn es still wird, dreh dich um – irgendwer steht immer hinter dir“. Im selben Moment kommen Flick und Kyra den Weg herauf, und Lia dreht sich um | Adaption | Beats F3 43:39–44:17 ohne Filmzeilen; Trost, keine Nachweltkarte |
| Trägt Lia Schattentöter, bittet er sie, ihn weiterzugeben, statt ihn zu behalten | Spieldesign | führt zur optionalen Niederlegung in `e3-hueterin` |
| Ende: `e3-ignatius-tot`, `e3-versoehnt`, Gruppe Kyra + Flick | Vertrag | umsetzung.md §2 |

### e3-hueterin – „Hüterin“ (`teil-3/hueterin.ts`, Orte, Texte und Zustand `hueterin-platz.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Eigene Karte `e3-trapas-zeremonie` mit der Geometrie aus `paladine-orte.ts`; Tag, Menge, zwei Paladine an der Treppe; Kyra und Flick folgen. Erzählerkarte: zwei Tage später, „diesmal ohne Strick um die Hände“. Kein Grab für Ignatius genannt | Struktur | umsetzung.md §3 („Grab in Trapas? nein“) |
| Runde über den Platz: Heilerin am Brunnen (Pflicht; kein Gegenmittel, nur Ruhe, Rat zu Kyra), optional ein Paladin (der Doktor ist in der Nacht des Ausrückens verschwunden, Suche ohne Erfolg – offen), ein Händler, der Mutters Familie vom Sehen kannte (kein Name, Mutter las früher am Brunnen vor), und solange Lia ihn trägt: Schattentöter in der Ordenskapelle unter das blaue Fenster legen (− `e2-schattentoeter`, `e3-schattentoeter-niedergelegt`) | Spieldesign | umsetzung.md §3; das Vorlesen am Brunnen ist eine kleine neue Verbindung zur Mutter aus Trapas |
| Lia bleibt bis zum Szenenende vergiftet (langsam); `e3-gift-abklingend` erst am Ende | Vertrag | umsetzung.md §2 |
| Rede des Großmeisters neu formuliert: Irrtum vor allen eingestanden, „Ihres, nicht meins“, der Orden stellt sich vor die Menschen, ob sie zu Aros beten oder nicht; Ignatius wird genannt; „hinter dir, nicht über dir“. Lias Antwort in drei Tonlagen (fest, ehrlich, trocken), keine beansprucht Herrschaft | Adaption | Beats F3 44:47–45:25 ohne Filmzeilen; Handoff: Schutz statt Herrschaft |
| Fibel einmalig (`e3-fibel-erhalten`, dieselbe Marke wie der Direkteinstieg); Ende: `e3-hueterin`, `e3-gift-abklingend`, `e3-orden-auftrag='schutz'` | Vertrag | umsetzung.md §2 |

### e3-epilog – „Zu dritt“ (`teil-3/epilog.ts`, Ort und Texte `epilog-weg.ts`, Abspann `epilog-credits.ts`)

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Eigene Karte `e3-feldweg-epilog`: der Weg mit den Grasstreifen zwischen den Zäunen und der Platz unter dem einzelnen Baum; Morgen, Begleiter Kyra und Flick | Struktur | assets.md, Kompromiss (3) |
| Gespräche beim Gehen in festen Zonen und fester Reihenfolge: Kyra (seit dem Sommer; Wahl, wie Lia an die Eltern denkt – jede Antwort: sie wären stolz), Kyra über Elnon, Flick als Schutz der Schwestern | Spieldesign | umsetzung.md §3; „vor einem Jahr“ passt nicht zum Spielkalender (Quellenprüfung §2) |
| Lia erfährt hier, dass Elnon tot ist und Kyras Bericht im Wald gelogen war. Drei tröstende Antworten (keine Schuldzuweisung), Flick erinnert an „Mischling“ und wünscht ihm das trotzdem nicht; Lia fragt nach Foltan, Azar und Alastir; Kyra will es der Bruderschaft selbst sagen und weiß aus Vamirs Halle, dass die meisten nach Süden entkommen sind (Baris, Teil II `gefangene.ts`). Die Umarmungsantwort erinnert nur an das Wegschieben am Stein, wenn Lia Kyra dort in den Arm nehmen wollte (`e3-ra-kyra-antwort = 2`). Tagebuch: `e3-elnon-wahrheit` berichtigt „Kyras Bericht (unbestätigt)“ | Kanon | Nutzerentscheidung: Elnon ist tot (umsetzung.md, Vorrang) |
| Flicks Rolle neu formuliert („lässt mir das Fell gerben – gesagt hat er das nicht, aber geguckt“, „Schutztruppe, eine Frau stark, bezahlt in Äpfeln“); das Wort „Leibwächterin“ und die Filmzeilen entfallen | Adaption | Keine Filmzeilen |
| Optional unter dem Baum: das Versprechen, irgendwann zu den Steinhügeln der Eltern heimzugehen (kein Besuch) | Spieldesign | Handoff: Verweis erlaubt, Besuch wäre neue Handlung |
| Am Wegende gehen die drei weiter; die Kamera bleibt zurück, im Vordergrund erscheint Valentus (`erscheinung.ts`) und löst sich auf. Er spricht nicht. Die Erzählung nennt ihn über Farbe und Bart („etwas Türkises, ein alter Mann mit grauem Bart“), ohne Ignatius’ „dreh dich um“ aufzugreifen, damit niemand ihn für Ignatius’ Geist hält | Darstellung | Film F3 46:39; Handoff: Valentus, nicht Ignatius |
| Erzähler über der Tafel `e3-epilog`: Vamir fort, Verbleib der zehn Dinge und des Doktors unbekannt | Neutral | Handoff: Offenes bleibt offen |
| `e3-finished`, Speicherpunkt `G.state.save('teil-3', 'e3-epilog', { book3Finished: true })`, Abspann „Ende des dritten Buches“ (`BOOK3_CREDITS` über `kapitel-5/credits`), Titel. Fortsetzen danach: kurze Schlusswahl (Abspann / Titel) wie in Teil II | Struktur | Übergangsvertrag |

### Technische Behelfe (Taktik-Engine ist für Teil III nur lesbar)

- Teamwechsel (Kyra), neues Aussehen (Lia mit Stab) und Vamirs Sprung laufen über Entfernen und erneutes Erscheinen
  derselben Einheit; Level, EXP, LP/MP und Abklingzeiten werden übernommen (`battle-shared.respawn`).
  `BattleResult.dead` führt dadurch `ignatius` und die Deserteure auf, obwohl niemand stirbt (`RITUAL_LEAVERS`).
- Die Engine kennt nur türkise Magieeffekte. Vamirs Violett, Ignatius’ Bernstein und die Ritualladung werden über einen
  defensiven Zugriff auf die Effekte der Kampfszene gezeichnet (`battle-shared.flare`); fällt er weg, fehlt nur die Farbe.
  Das Statussymbol „Schutzwall“ (Ignatius’ Bernsteinwall) bleibt in Engine-Türkis.
- Umgestoßene Ständer: Das Kampffeld wird zu Erde (Regel), das Requisit kippt per Tween (`tipProp`).
- Die Befreiung durch den Paladin ist geskriptet (die Engine befreit nur durch eine Aktion der Spielerin).
- Blut im Kampf (`battle-shared.battleBlood`): dunkelroter Kamerablitz (nicht bei reduzierter Bewegung), Tropfen über die
  Effekte der Kampfszene und eine im Code gezeichnete Lache, die per `postupdate` der Figur folgt (auch beim Drehen der
  Ansicht) und mit ihr verschwindet (common/blood.ts hat keine Kampfvariante). In der Welt nutzen `e3-falle` und
  `e3-vamir` `chapters/common/blood.ts` (`bloodHit`, `bloodPool` mit dem Requisit `blutlache`, `preloadBlood`) wie
  Teil II; den Treffersound spielt die Szene selbst.
- Möglicher Hänger in `battle-shared.respawn` (Notiz aus dem alten Build) untersucht: `ctx.spawn` blockiert nicht
  (Fokus erzeugt die Ansicht bei Bedarf, `remove`/`spawn` warten nur auf eigene kurze Tweens), Teamwechsel und
  Aussehenswechsel laufen über Einheiten-IDs (die Szene hält keine Einheitsobjekte), und ein neu erschienener Vamir ist
  im Zugsystem nach Tempo weiter die aktive Einheit. Beide Kämpfe liefen im Browser mit echter Eingabe durch
  (Stabübergabe im Zug der Spielerin, Kyras Bannbruch während eines KI-Zugs, Vamirs Sprünge) – kein Hänger. Ein echtes
  Risiko bleibt nur bei Hinweiskarten, die nicht abgewartet werden (`ctx.hint` setzt danach die alte Sperrzahl zurück);
  alle Hinweise in Teil III werden abgewartet.

### FFTA-Anpassung der beiden Kämpfe (Stufe P1, 2026-10-08)

| Kampf | Messung | Ergebnis |
| --- | --- | --- |
| Ritualkampf, Simulation (40 Läufe je Anstieg, Spielerin läuft zum Stein, stößt Ständer um, schießt) | Hohlweg 38/40, Felsen 40/40, offen 39/40 gewonnen; 5–7 Runden; Lia meist in Runde 4–5 frei, Ladung am Ende 1–3; Flick endet mit 12–18 von 39 LP | Gewinnbar, aber Flick gerät neben dem Stein unter Druck (Kyra trifft ~70 %) |
| Ritualkampf im Browser (echte Eingabe, Hohlweg) | Sieg in 5 Runden, 8 Züge; Flick befreit Lia in Runde 2, Stabübergabe Runde 3; Flick am Ende mit 3 von 39 LP; Trefferprognosen Bogen 79 %, Lichtstoß 97 %, Stabstrahl 100 % | Knapp, nicht trivial. Im ersten Lauf trafen die Mausklicks des Testtreibers das Feld neben dem Stein nicht; Flick blieb umringt stehen und fiel in Runde 4 (danach Tastatursteuerung des Cursors) |
| Duell, Simulation (40 Läufe je Ausstattung, mit/ohne Tinktur und Schattentöter) | 38/40 gewonnen; 5–6 Runden; Lia endet mit ~10 von 20 LP; Vamir trifft ~70 % | Vorher (Sprung kostete Vamirs Zug, Kalter Stoß 3) 100 % Siege mit 18/20 LP: zu leicht |
| Duell im Browser (echte Eingabe) | Sieg in 5 Runden, drei Schildbrüche, Lia verlor 10 von 20 LP; Prognosen Stabstrahl 95–100 %, Stabimpuls 90 % | Wie geplant |

Lia im Ritualkampf und im Duell: Stufe 7 (vorher Stufe 1 ohne gespeicherten Fortschritt), vergiftet 20/34 → 20 LP und
12 MP. Die Simulation war ein temporärer Vitest-Lauf und ist nicht eingecheckt; die Browserläufe liegen in
`game/e2e/scratch-teil3-port/` (per `.gitignore` ausgeschlossen, nur lokal). Die Endabnahme steht in
[Prüfbericht](pruefbericht.md).

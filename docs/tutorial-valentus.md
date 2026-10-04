# Prolog: Der Traum, der bricht

> Aktueller Stand vom 04.10.2026: Der spielbare Prolog erzählt die tatsächlich geschehene Schlacht von Dunkelhain in der Reihenfolge Rat und Konflikt, Schlacht, Verwundung, Flucht, Rettung und Zuflucht. Die frühere Fiebertraum-Inszenierung in diesem Entwurf ist überholt. Der Axtkämpfer bleibt verwundet auf dem Feld. Valentus erhält im Tutorial Schutz vor einer Niederlage. Die aktuelle Implementierung liegt unter `game/src/scenes/`.


Stand: 3. Oktober 2026. Phase 1, abgestimmtes Konzept. Grundlage: [Creative Direction](creative-direction-tutorial.md) und [Roman, PDF-Seiten 1 bis 13](../sources/novel/roman-selantis-2.txt). Regeln und Produktion: [Implementierungsplan](tutorial-implementation-plan.md). Einstellungen: [Storyboard](../design/intro-storyboard.json). Gemäß neuer ausdrücklicher Nutzervorgabe folgen Bildstil und Charakteraussehen der gesetzten Pixelbaseline und geprüften Filmreferenzen; der Roman bleibt Handlungsvorlage.

## Leitidee

Valentus ist zuerst als gewaltiger Magier in seinem Fiebertraum spielbar. Der Junge unter der Axt ist sein Ziel. Nach der Rettung zerfällt der Junge als eines der ersten Bildteile, noch vor der Landschaft; die bereits vorhandene Wunde wird sichtbar. Die Flucht entzieht ihm Kraft und bleibt Teil des Fiebers. Zuletzt verlangt der Weg zur Wiege jeden einzelnen Schritt. Dieselbe Taste, die den Strahl auslöste, hebt seine Hand über die Kinder. Weißes Licht wird zum Sonnenlicht auf Lias Buch.

Claude hat E1/E2 entschieden: Die Rettung ist ein veränderter Fiebertraum. Die Fieberspirale führt durch Schlacht → Flucht → Sturz → Versorgung bei Kerzenlicht → Echo der letzten Magie (≤ 1 s) → erstes wirkliches Erwachen. Erst hier ist das gesamte Bild vollständig scharf: Kerze erloschen, Mondlicht im dunklen Zimmer.

## Quellenstatus

| Element | Grundlage | Status im Entwurf |
| --- | --- | --- |
| Hang, Heere, verdunkelter Tag, Strahl, Junge, Axt, Falke, Bolzen, Druckwelle | Roman S. 3 bis 4 | Handlungsmotive; Rettung als veränderter Fiebertraum gemäß E1 entschieden. |
| Flucht, rechte Wundseite, Waldstationen, Sturz, Versorgung, Erwachen im Bett | Roman S. 1 bis 4 | Fieberspirale gemäß E2 entschieden; Tempo, Randunschärfe und versagende Zauber inszeniert. |
| Retterpaar, Kerze, Verband, Holzzimmer, mühsamer Weg, zwei Kinder, Blau, Blitz, Verschwinden | Roman S. 2, 5 bis 6 | Romanmotive; Einzelschritte und verdeckende Nahaufnahmen adaptiert. |
| Lia liest am Baum, Lederbuch, Abendsonne, Holzschuhe | Roman S. 8 bis 12 | Handlung bleibt Roman; Match Cut und Demoende adaptiert. S. 13 liegt außerhalb der Demo. |
| Valentus, Lia und Banner: Film-Look | Nutzervorgabe; Creative Direction, Abschnitt "Figurenlook nach Filmvorgabe" | Verbindlicher Produktionslook; keine Übernahme der Filmhandlung. |
| Leitmotiv-Blau, Telegraphe, Schutzfunken, HUD, Spielwerte | Creative Direction / Spielentwurf | Gestaltungsregeln. Empfänger, Natur der Kraft und endgültiges Schicksal bleiben Rätsel. |

## Aktueller Bildstil und Charakterlook

Nutzervorgabe (Film-Look), Handlung bleibt Roman. Die [Nutzerbaseline](../sources/reference/artstyle/user-pixel-baseline.png) bestimmt Pixelstruktur, kleine proportionierte Figuren und die leicht erhöhte Spielperspektive. Abschnittsfarben folgen der Creative Direction.

- Valentus: langes dunkelbraunes bis fast schwarzes Haar mit Mittelscheitel bis zur Brust, schmales ernstes Gesicht, schmaler kurzer Kinnbart. Dunkelblaue Robe mit weiten Ärmeln, breiter gebrochen weißer Vorderbahn und schmalen hellen Längsbahnen, dunkler Gürtel mit großer ovaler Schnalle, helle runde Zierelemente am Hals. Ausgezehrt und gewaltig; Hände frei, kein Stab, keine Rüstung, kein dauerhaftes Geistleuchten.
- Flucht: derselbe Mann im dunklen zerschlissenen Kapuzenmantel, dunkle Strähnen unter der Kapuze, Blut rechts unter den Rippen, Schnabelstiefel. Zuflucht: Mantel abgelegt, geöffnete Robe bzw. Hemd und dicker Bauchverband.
- Lia (Film-Triss): hellbraunes bis dunkelblondes Haar mit goldenen Lichtern, seitliche Flechtsträhnen nach hinten gebunden, weiße geraffte Bluse mit weiten Ärmeln, langer beige-senfgelber Rock, dunkler geflochtener Gürtel. Beim Lesen barfuß, braunes Lederbuch; beim Gehen Holzschuhe.
- Banner (Film Folge 1, 00:50): Verbündete blau-weiß radial mit grauem geflügeltem Zentralzeichen, Tierart offen. Dunkelschatten schwarz-weiß geviertelt mit dunklem Zentralzeichen. Dunkelschatten sind menschliche Fußsoldaten mit schwarz-weißen Wappenröcken; Junge und Falke tragen hell/blau-weiß.
- Retterin: lange rötliche Locken, grüne Augen, langes braunes Kleid gemäß Roman S. 2.

Referenzen: [Valentus](valentus-film-look.md), [Figuren](character-film-reference.md), [Wappen](heraldry-reference.md). Für diesen Prolog gilt die obige Nutzervorgabe der Creative Direction. Style-Frames geben Palette und Atmosphäre vor; ihre Perspektive und der alte Valentus-Look sind verworfen. Sie werden nicht als Bühnen verwendet.

## Sehen, hören, handeln

Zielzeit: fünf bis acht Minuten, abhängig vom Planen. Battle etwa zwei bis vier Minuten; alle Zeiten sind Produktionsrichtwerte.

| Abschnitt | Spielerhandlung | Bild und Klang |
| --- | --- | --- |
| Hangkamm, 10 bis 20 s | WASD/Pfeile, wenige Schritte vorwärts | Wind zieht an Robe und Haar. Trompeten setzen die Heere in Bewegung. Auf der Hangschulter erscheint das 10 × 8-Raster. Nachhall, atmende Bildränder und träge Glutpartikel deuten den Traum an. |
| Zug 1: Linie | Bewegung planen/zurücknehmen; Q/Strahlicon, Ziel wählen, bestätigen | Zwei schwarze Krieger in einer Linie. Symbole und Zielfelder zeigen ihren Angriff auf Valentus. Strahl trifft beide: kurzer Freeze-Frame, Bildstoß, pixeliges Hitzeflimmern. |
| Zug 2: Junge | R/Druckwellenicon, Fläche und Rückstoß prüfen, bestätigen | Rechts fällt der sechzehn- bis siebzehnjährige Junge, Hände vor dem Gesicht. Axtsymbol über dem Gegner, rotes Zielfeld unter dem Jungen. Gedankenstimme: "Der Junge." Strahlvorschau zeigt den möglichen Treffer am Jungen rot. Die präzise Druckwelle schützt Verbündete und schleudert den Axtkämpfer weg. |
| Zug 3: Bolzen | In die Schusslinie treten und warten oder Schützen beseitigen | Armbrustschütze zielt auf den sich aufrappelnden Jungen. Gestrichelte Linie zeigt den ersten Treffer. Valentus fängt den Bolzen mit blauen Schutzfunken ab. Felsen unterbrechen Linien sichtbar. |
| Zug 4: Rückblick | Weg freigeben, gegebenenfalls warten | Der Junge erreicht die eigenen Reihen, dreht sich um; sein Schildsymbol bestätigt die Rettung. Hinter Valentus erscheint eine menschliche Feindsilhouette mit Angriffssymbol. Halt, Traumbruch. Ein schneller Spieler erreicht diesen Beat nach drei bestätigten Zügen. |
| Traumbruch, 8 bis 12 s | Cutscene | Schlachtlärm saugt sich in tiefes Brummen. Farbe läuft von außen aus. Blut rechts unter den Rippen bleibt rot. Lebensanzeige fällt von 100 auf 12. Der Junge zerfällt als eines der ersten Bildteile in aufwärts driftende Pixelblöcke, vor der Landschaft. Weiß. "Ein Fiebertraum." Jagdhorn, Hunde, Schwarz, Mondwald. Der Traum fällt weiter in die Flucht. |
| Flucht, 45 bis 60 s aktive Spielzeit | Bewegen; E am Bach; E halten am Hang | Dunkler zerschlissener Kapuzenmantel, dunkle Strähnen gemäß Filmlook, Schnabelstiefel. Feine, langsam atmende Randunschärfe bleibt durch die gesamte Flucht. Rennen wird Laufen, dann Gehen. Wurzel, Bach, Hochziehen, krummer Stamm. Herzschlag, Blutspur, ferne Fackeln, näher klingende Hunde. Q/R erzeugen erlöschendes Blau, die Slots sind grau. Glitschiger Stein, Rutschen, dumpfer Schlag, Schwarz. |
| Versorgung und Echo | Cutscene | Nach dem Sturz Stimmen von Frau und Mann im Schwarz. Verschwommenes Gesicht der Frau bei Kerzenlicht (`cut-woman-face`), lokal klarer, Randunschärfe bleibt. "Habt keine Angst. Ihr seid in guten Händen." Schwarz. Letzte ausgeführte Magieaktion als entsättigtes Aufblitzen, ≤ 1 s, unmittelbar vor dem wirklichen Erwachen. |
| Wiegenweg, mit Versorgung 70 bis 100 s | E halten zum Aufstehen; neue Richtungseingabe pro Schritt | Erstes wirkliches Erwachen: schweißgebadet, erstmals vollständig scharfes Bild, erloschene Kerze, nur Mondlicht. Blick auf entzündeten Wundrand. "Sie werden mich hier finden." Dann: "Die Hoffnung muss weiterleben." Rechte Hand an der Seite. Taumeln, Dielenknarren, langsame Kameranäherung. Loslassen: abstützen und atmen. |
| Wiegenkante | Q, dieselbe Taste wie der Strahl | Bildschirmfüllend `cut-cradle-sleep`: zwei gleich eingehüllte schlafende Kinder. Ein Herzschlag Stille. "Es tut mir leid. Ich hoffe, du kannst mir verzeihen." `cut-cradle-hand`: Hand und Blau über der Wiegenmitte; die Kante verdeckt die Zielseite. Blitz, Knall, kurzer dunkler Nachblick (`cut-cradle-empty`): beide Kinder schreien, Valentus' Platz ist leer. Weiß übernimmt wieder das Bild. |
| Lia, 10 bis 20 s | Buch schließt sich, freie Bewegung | Weiß wird zum Gegenlicht der tiefen Abendsonne. Lia blinzelt, barfuß am Baum, Lederbuch auf dem Schoß. Portrait wechselt zu LIA. Sie schlüpft in Holzschuhe, geht einige Schritte; Titel SELANTIS. |

## Gefahr und Bedienung

HUD: Valentus-Portrait, schmale Lebensanzeige, zwei Magieicons, kurze Zugleiste. Das Jungenportrait trägt ein Schild über einer Figur. Absichten verwenden Symbol, Feldmuster und Schusslinie. Vorschauen zeigen Treffer, Deckung und Rückstoß-Endfelder aus der geplanten Position. Klick/Enter bestätigt, Rechtsklick/Escape nimmt zurück. Bedienhilfen bleiben eine Zeile und verschwinden nach erster Nutzung.

Valentus bleibt im Traum bei 100 Leben. Bei der ersten Fehlentscheidung am Jungen greift der Falken-Soldat mit zwei Kurzschwertern ein; der gefährdete Zug wird zur Planung zurückgesetzt. Weitere Fehlversuche stoppen an der Gefahrvorschau. Ab dem fünften Versuch pulsiert die passende Bedienhilfe. Der Erfolg wird als Lernfortschritt vor dem Bruch gespeichert.

Cutscenes erlauben Pause und gehaltenes Überspringen nach einer Mindestlaufzeit. Flucht und Wiegenweg behalten eigene Eingaben. Lia bekommt einen eigenen Anfangszustand; mitgenommen werden die gesehenen Bedienhilfen.

## Farbdramaturgie

Gemeinsames Magieblau: #397FC1. Der Wald verwendet dunkles, entsättigtes Nachtblau. Lia hat im Demoende eine gold-grüne Welt; ihre spätere Kraft greift das Magieblau wieder auf.

| Abschnitt | Grundton | Akzent und Licht |
| --- | --- | --- |
| Traum-Schlacht | Stahlgrau #59616A, Schlamm-Oliv #5D6043, Rauch #34383D | Dunkelblaue Filmrobe mit hellen Längsbahnen, Magieblau, Glut-Orange im Tal; flaches, verdunkeltes Tageslicht. |
| Traumbruch | Fast monochrom | Blut-Rot #9A3438; weiß ausbrennende Ränder. |
| Flucht | Nachtblau #172535, Schwarzgrün #182A23 | Silbermond, Tau, ferne bedrohliche Fackeln. |
| Versorgung | Dunkles Holz #392A23 | Kerzen-Bernstein #D89B4B als erster sicherer warmer Lichtpunkt. |
| Erwachen / Wiege | Dunkles Holz, Mondlicht | Kerze erloschen; schwaches Blau, grelles Weiß, dunkler Nachblick. |
| Lia | Sommergold #D6AD59, sattes Grün #52783C | Hellbraun-dunkelblondes Flechthaar, weiße Bluse, beige-senfgelber Rock und braunes Leder im Abendgegenlicht. |

Style-Frames: [Traum-Schlacht](../output/imagegen/style-battle-dream-v1.png), [Zuflucht/Wiege](../output/imagegen/style-refuge-cradle-v1.png). Palette und Atmosphäre sind abgenommen; Perspektive und alter Valentus-Look verworfen. Produktionsbühnen werden separat erstellt: `bg-flight-a` + `bg-flight-b` ergeben 1280 × 360 px; `bg-refuge-room-candle` zeigt die Versorgung, `bg-refuge-room-dark` das Erwachen und den Wiegenweg. Die Wiege im Raum gehört zum Hintergrund; der Wiegenmoment verwendet bildschirmfüllende Nahaufnahmen.

## Abnahme

Frühe Bewegung, Gegnerabsichten vor jeder Entscheidung, Strahl und Druckwelle selbst bestätigt, Junge erreicht die eigenen Reihen. Der Bruch enthüllt die bestehende Wunde (`cut-wound`); der Junge zerfällt vor der Landschaft. Waldtempo sinkt, Zauber erlöschen, jeder Wiegen-Schritt bleibt spielbar. Zwei Kinder und verdeckte Zielseite sind lesbar. Blitz und Sonne bilden den Match Cut. Lia wird frei steuerbar, dann erscheint der Titel. FALL → CARE (Kerze) → ECHO (≤ 1 s) → WAKE (dunkel, vollständig scharf) setzt die entschiedene Fieberspirale um.

Die visuelle Abnahme prüft Valentus' lange dunkle Haare, Mittelscheitel, schmalen Kinnbart, dunkelblaue Robe mit hellen Bahnen und ovale Gürtelschnalle, Lias Film-Triss-Look sowie die Banner aus Film Folge 1.

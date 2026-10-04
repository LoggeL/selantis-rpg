# Creative Direction: Prolog-Tutorial (Review von tutorial-valentus.md)

> Aktueller Stand vom 04.10.2026: Der spielbare Prolog erzählt die tatsächlich geschehene Schlacht von Dunkelhain in der Reihenfolge Rat und Konflikt, Schlacht, Verwundung, Flucht, Rettung und Zuflucht. Die frühere Fiebertraum-Inszenierung in diesem Entwurf ist überholt. Der Axtkämpfer bleibt verwundet auf dem Feld. Valentus erhält im Tutorial Schutz vor einer Niederlage. Die aktuelle Implementierung liegt unter `game/src/scenes/`.


Stand: 3. Oktober 2026. Verfasst vom Creative Director. Dieses Dokument hat Vorrang vor `tutorial-valentus.md` und `intro-storyboard.json`, wo beide sich widersprechen. Quellentreue bleibt Pflicht – aber Quellentreue ist die Untergrenze, nicht das Ziel. Das Ziel ist eine Eröffnung, an die sich Spieler erinnern.

## Urteil zum bisherigen Konzept

**Was gut ist und bleibt:** Scope (eine kleine Begegnung statt Massenschlacht), keine Zufallstreffer, kein Grind, Vorschau-vor-Bestätigung, Wiege mit zwei ununterscheidbaren Kindern, kein Todesbeweis, HUD-Sparsamkeit, Lia startet ohne Kräfte.

**Was ich verwerfe:**

1. **"Öffne den Rückweg für einen unbenannten Soldaten"** ist ein Logistikauftrag, kein Moment. Der Roman liefert uns den stärksten denkbaren Anker und das Konzept ignoriert ihn: der **junge Soldat, sechzehn, siebzehn**, der neben Valentus zu Boden geschleudert wird, die Hände vor dem Gesicht, die Axt über ihm (S. 4).
2. **Die Verwundung "durch Rauch und Lärm, Ursache außerhalb des Bildes"** ist eine Verlegenheitslösung. Sie wirkt wie ein Schnitt, der etwas verbergen muss.
3. **Die lineare Chronologie** (Schlacht → Wunde → Flucht) wirft das beste Werkzeug des Romans weg: **Die Schlacht ist ein Fiebertraum.**
4. **Die Palette des Battle-Konzeptbilds** (sattes Wiesengrün, freundlich) widerspricht dem Text: "Der Tag schien zur Nacht zu werden."
5. **Zug-für-Zug fehlt Dramaturgie.** Vier gleichförmige schwarze Gegner, die "den Weg blockieren", erzeugen keine Spannung. Gegner brauchen sichtbare Absichten.
6. **Die Zuflucht ist reine Cutscene.** Der Roman beschreibt den Weg zur Wiege als "Tagesmarsch" über wenige Meter – das ist der spielbare Höhepunkt des Prologs, nicht ein Filmschnitt.

## Die Leitidee: Der Traum, der bricht

Der Spieler beginnt – wie vorgegeben – spielbar als übermächtiger Valentus auf dem Schlachtfeld. Er weiß es noch nicht, aber er spielt **Valentus' Fiebertraum**. Im Traum kann Valentus retten, wen er in Wirklichkeit nicht retten konnte. Wenn der Junge in Sicherheit ist, **zerbricht der Traum**: Die Farbe läuft aus der Welt, der Schlachtlärm fällt weg, durch die blau-weiße Robe sickert Blut – die Wunde war die ganze Zeit da. Ein **Horn** erklingt, und es ist nicht mehr die Schlachttrompete, sondern das Jagdhorn der Verfolger. Hart auf: Mondwald, Hunde, Flucht.

Warum das stärker ist:
- Die Verwundung braucht keinen erfundenen Täter. Sie ist einfach *da*, als die Illusion fällt.
- Der Spielerfolg wird nicht zurückgenommen, aber er bekommt Gewicht: Beim Zerbrechen flackert auch der gerettete Junge und löst sich mit der Welt auf. Wer den Roman kennt, weiß, warum.
- Es ist näher an der Romanstruktur als das alte Konzept, nicht weiter weg.
- Es führt die Tutorial-Steuerung logisch über: Allmacht im Traum → Ohnmacht in der Wirklichkeit.

Das "Fiebertraum"-Wort fällt erst beim Bruch, als einzige Texteinblendung, in Valentus' Gedankenstimme: *"Ein Fiebertraum."* Vorher gibt es nur subtile Hinweise: leichtes Nachhallen der Geräusche, ein kaum merkliches Atmen der Bildränder, Glutpartikel, die einen Tick zu langsam fallen.

## Farbdramaturgie (verbindlich)

Jeder Abschnitt hat eine Leitfarbe. Die einzige Farbe, die durch alle Abschnitte wandert, ist **Valentus' Blau** – dasselbe Blau im Strahl, im Wiegenschimmer und (viel später) in Lias Kraft. Der Spieler soll das Blau wiedererkennen, ohne dass es erklärt wird.

| Abschnitt | Grundton | Akzent | Licht |
| --- | --- | --- | --- |
| Schlacht (Traum) | Stahlgrau, Schlamm-Oliv, zertrampeltes Gras, Rauch | Valentus-Blau, Glut-Orange der Brände im Tal | Gedämpft, flach, "Tag wird zur Nacht" |
| Traumbruch | Entsättigung bis fast Monochrom | Nur das Blut-Rot an der rechten Seite bleibt farbig | Weißes Ausbrennen an den Rändern |
| Flucht | Nachtblau, Schwarzgrün | Silbernes Mondlicht, Tauglitzern, ferne Fackeln (warm, bedrohlich) | Kalte Lichtkegel durch Wolkenlücken |
| Zuflucht | Dunkles Holzbraun | Bernstein der Kerze – die erste warme, sichere Farbe des Spiels | Ein einziger Lichtpunkt |
| Wiege | Bernstein → Blau | Wiegenschimmer, dann grelles Weiß | Blitz, Knall, Dunkel |
| Lia | Sommergold, sattes Grün | Rotblonde Locken, das Lederbuch | Tiefe Abendsonne, Gegenlicht |

Der Übergang Wiege → Lia ist ein **Match Cut**: Das weiße Ausbrennen des Blitzes blendet in das Gegenlicht der tief stehenden Sonne, die Lia beim Lesen blendet (S. 10). Kein Texttafel-"14 Jahre später" nötig; eine kleine, leise Zeile "Viele Jahre später" ist erlaubt, aber nicht mehr.

## Die Schlacht: vier Züge, vier Lektionen, vier Romanmomente

Gegner zeigen ihre **Absicht für den nächsten Zug** als Symbol über dem Kopf und als markierte Zielfelder (Telegraphing). Das ist die eigentliche taktische Lektion: lesen, was kommt, und reagieren. Valentus ist übermächtig, der Junge nicht.

Spielbares Feld: 10 × 8 Felder auf einer Hangschulter. Dahinter, hangabwärts, das schwarze Heer als animierte Silhouettenmasse; hinter Valentus die aufgereihten Verbündeten mit Bannern (neutral oder belegt, siehe Wappenregel).

| Zug | Romanmoment | Situation | Lektion |
| --- | --- | --- | --- |
| 0 (Echtzeit, 10–20 s) | "Da stand er nun." | Valentus steht am Hangkamm, Wind in Robe und Haar. Trompeten. Beide Heere setzen sich in Bewegung. Der Spieler läuft wenige Schritte nach vorn zur Hangschulter – das löst den Zusammenprall und das Raster aus. | Bewegung, Kamera, Orientierung |
| 1 | Energiestrahl auf zwei anstürmende Krieger (S. 4) | Zwei schwarze Krieger stürmen in einer Linie heran, Absichtssymbol: Angriff auf Valentus. | Bewegen (rücknehmbar), Linie anvisieren, Strahl. Beide fallen. Der Strahl muss sich *gewaltig* anfühlen: Bildschirm-Schütteln, Hitzeflimmern, ein kurzer Freeze-Frame. |
| 2 | Der junge Soldat wird zu Boden geschleudert, die Axt über ihm (S. 4) | Rechts von Valentus fällt der Junge. Ein Axtkämpfer steht über ihm, Absichtssymbol: tödlicher Hieb auf den Jungen im nächsten Gegnerzug. Der Strahl würde den Jungen mittreffen (Vorschau zeigt das rot!). | Druckwelle: Fläche, Rückstoß-Vorschau. Der Axtkämpfer fliegt weg – bestenfalls in einen Felsen oder einen zweiten Gegner (Kollisionsschaden sichtbar). Lehrt: das stärkste Werkzeug ist nicht immer das richtige. |
| 3 | Armbrustbolzen (S. 3/4) | Ein Armbrustschütze hangabwärts legt an: gestrichelte Schusslinie auf den Jungen, der sich gerade aufrappelt. | Valentus stellt sich in die Linie (er hält stand, Bolzen prallt an ihm ab – Übermacht) **oder** beseitigt den Schützen. Lehrt: Bewegung als Schutzaktion, Sichtlinie, Fels als Deckung. |
| 4 | "Er spürte den Feind im Nacken" (S. 4) | Der Junge flieht den freien Weg hangaufwärts zu den eigenen Reihen. Ziel erfüllt. Erfolgsmoment: der Junge dreht sich einmal um. Dann: ein Schatten hinter Valentus, Absichtssymbol direkt in seinem Rücken – und **der Traum bricht**, bevor der Spieler handeln kann. | Ziel erreicht → Übergang |

Regeln dazu:
- Der Junge stirbt im Spiel nie. Ist er in Gefahr und der Spieler reagiert falsch, wird der Hieb durch einen eingreifenden Falken-Soldaten (zwei Kurzschwerter, S. 4) einmal abgefangen und der Zug wiederholt sich mit einem kurzen Hinweis. Kein Game Over in den ersten fünf Minuten.
- Ein erfahrener Spieler schafft es in drei Zügen, der typische Spieler in vier, Hilfe ab dem fünften.
- Valentus nimmt Treffer, aber sie prallen sichtbar ab (kleine blaue Schutzfunken, Lebensanzeige wackelt kaum). Seine Lebensanzeige ist im Traum voll und bleibt es. Beim Traumbruch fällt sie in einem Ruck auf einen Bruchteil – das ist der einzige Moment, in dem die Zahl etwas erzählt.
- Ziel-HUD: ein kleines Symbol "Schild über Figur" am Portrait des Jungen in der Zugleiste. Kein Questtext außer einem einzigen Satz beim Auftauchen: *"Der Junge."* (Gedankenstimme, nicht Tutorialton.)
- Tutorialhinweise sprechen **Bedienung**, nicht Lösung: "Linksklick: Feld wählen. Rechtsklick: zurück." – maximal eine Zeile, unten, verschwindet nach erster Nutzung.

## Traumbruch (Cutscene, 8–12 s)

1. Der Junge erreicht die eigenen Reihen, dreht sich um. Halt.
2. Schatten im Nacken, Absichtssymbol in Valentus' Rücken.
3. Alle Geräusche saugen sich in ein tiefes Brummen. Farbe läuft von außen nach innen aus dem Bild.
4. Nahaufnahme (größeres Sprite oder Portraitillustration): Blut breitet sich rechts unterhalb der Rippen auf der blauen Robe aus. Die Lebensanzeige bricht ein.
5. Die Welt zerfällt in Pixelblöcke, die nach oben wegdriften – auch der gerettete Junge.
6. Weiß. Text, leise: *"Ein Fiebertraum."*
7. Ein Jagdhorn. Hundegebell. Schnitt auf Schwarz → Mondwald.

## Flucht (spielbar, 45–70 s)

Jetzt in dunklem, zerschlissenem Kapuzenmantel, dunkle Haarsträhnen (Filmlook), Blut an der rechten Seite, Schnabelstiefel (S. 1–2). Die Steuerung kippt von Allmacht zu Ohnmacht:
- Valentus startet im Laufen, wird aber stetig langsamer (rennen → laufen → gehen, wie im Text).
- Herzschlag-Vignette pulsiert, Blutstropfen bleiben als Pixelspur zurück.
- Fackeln der Verfolger tauchen am Bildrand auf, Hunde werden lauter. Kein Fangen, kein Game Over – aber der Druck ist hörbar.
- Stationen aus dem Roman als Wegmarken: steiler Hang hinunter, große Wurzel (kurzes Stolpern, wenn man drüberläuft), Bachlauf (Sprung per Interaktionstaste), Abhang hinauf (Taste halten zum Hochziehen), krummer Baumstamm (Abstützen).
- Seine Zauberslots aus der Schlacht sind im HUD noch da – **ausgegraut**. Drückt der Spieler sie, flackert nur ein schwaches blaues Glimmen an der Hand und erlischt. Kein Text dazu.
- Ende: glitschiger Stein, Rutschen, dumpfer Schlag. Schwarz.

## Zuflucht und Wiege (Cutscene mit spielbarem Höhepunkt, 70–100 s)

1. Schwarz. Stimmen als Untertitel: Frau: "Schnell, hole ihm etwas Wasser! Ich glaube, er wacht auf." Mann: "Unglaublich. Als ich ihn gefunden habe, dachte ich schon, er sei tot."
2. Augen öffnen: verschwommener Pixelblur, der langsam scharf wird. Kerzenlicht. Die Frau: lange rötliche Locken, langes braunes Kleid, grüne Augen, besorgtes Lächeln (S. 2). "Habt keine Angst. Ihr seid in guten Händen." Schwarz.
3. Ein Traum-Echo von **höchstens zwei Sekunden**: die letzte Aktion, die der Spieler in der Schlacht ausgeführt hat (sein Strahl oder seine Druckwelle), entsättigt und verzerrt. Die Entscheidung des Spielers kehrt als Erinnerung zurück.
4. Erwachen im Dunkeln, schweißgebadet. Gedankenstimme, knapp: "Sie werden mich hier finden." – "Die Hoffnung muss weiterleben."
5. **Spielbar: der Weg zur Wiege.** Valentus steht auf (Taste halten). Jeder Schritt ist eine eigene Eingabe; die Figur taumelt, die Dielen knarren, die Kamera rückt ganz langsam näher. Ein paar Meter, die sich anfühlen wie ein Tagesmarsch. Loslassen = er stützt sich ab und atmet, kein Rückschritt.
6. Kante der Wiege. Blick hinein: **zwei** Kinder, gleich eingehüllt, schlafend. Ein Herzschlag Stille. Gedankenstimme: "Es tut mir leid. Ich hoffe, du kannst mir verzeihen."
7. Spieler hebt die Hand (letzte Eingabe des Prologs, dieselbe Taste wie der Strahl in der Schlacht – das ist der Punkt). Blauer Schimmer um die Hand. Die Kamera ist so gewählt, dass Hand und Schimmer über der Mitte der Wiege liegen und nicht verraten, welches Kind.
8. Grelles Licht, Knall. Leerer Raum. Zwei schreiende Säuglinge. Das Weiß des Lichts hält an …
9. … und wird zur tief stehenden Abendsonne. Lia unter dem Baum, das Buch "Die Geschichten der Magierin Alana" auf dem Schoß, barfuß, blinzelt gegen das Licht (S. 10–11). Sie klappt das Buch zu. Portrait im HUD wechselt zu LIA. Freie Bewegung, Ende der Demo nach wenigen Schritten mit Titelkarte **SELANTIS**.

## Visuelle und technische Vorgaben für den Demo-Build

- Phaser 3, TypeScript, Vite. Interne Auflösung 640 × 360, ganzzahlige Skalierung, `pixelArt: true`.
- **Pragmatik für die Demo:** Jede Szene bekommt ein komponiertes Hintergrundbild (aus imagegen, anschließend auf echte Pixelgröße herunterskaliert und auf eine begrenzte Palette quantisiert) plus separate Kollisions-/Rasterdaten als JSON. Das ist kein Zerschneiden in Kacheln, sondern eine Bühne. Tilesets kommen später.
- Figuren als Spritesheets mit transparentem Hintergrund; jede Figur muss klein lesbar sein. Pflicht für die Demo: Valentus (Robe), Valentus (Mantel, verwundet), schwarzer Krieger, Axtkämpfer, Armbrustschütze, der Junge, Falken-Soldat, die Frau, Lia (lesend + gehend). Vier Richtungen nur für Valentus und Lia; Gegner dürfen zwei Richtungen plus Spiegelung haben.
- Ein Python-Skript im Repo normalisiert alle generierten Bilder: Nearest-Neighbour auf Zielgröße, Palettenreduktion, Alpha harte Kanten. Keine weichen Ränder, keine gemischten Pixelgrößen auf einem Bildschirm.
- Portraits 64 × 64 für Valentus, den Jungen, die Frau, Lia.
- Effekte (Strahl, Druckwelle, Blut, Traumbruch-Zerfall, Wiegenschimmer, Blitz) werden **im Code** gebaut (Partikel, Shader/Postprocessing, Tweens), nicht als generierte Bilder.
- Sound: WebAudio-Synthese oder frei verfügbare Platzhalter sind okay; Horn, Herzschlag, Dielenknarren und das "Einsaugen" beim Traumbruch sind die vier Sounds, die wirklich zählen.
- Überspringbar: jede Cutscene per gehaltener Taste (nicht beim ersten Durchlauf schon nach einer Sekunde).
- Debug: `?scene=battle|break|flight|refuge|lia` zum direkten Springen.

## Entscheidungen zu Codex' Einwänden (Phase 1)

**E1 – Rettung des Jungen: angenommen als veränderter Fiebertraum.** Im Roman stirbt der Junge. Im Traum darf Valentus ihn retten – das ist genau der Punkt. Die Tragik liegt im Zerfall: Beim Traumbruch löst sich der Junge als einer der *ersten* Bildteile in Pixelblöcke auf, noch vor der Landschaft. Keine Texttafel erklärt das. Wer den Roman kennt, versteht es; wer ihn nicht kennt, spürt den Verlust.

**E2 – Zeitrahmen: Codex hat recht, das Erwachen im Mondwald wäre eine neue Chronologie.** Lösung: **die Fieberspirale.** Der Fiebertraum sinkt durch Valentus' Erinnerungen zur Gegenwart hinab – Schlacht (am längsten her) → Flucht (letzte Nacht) → Gefundenwerden und die Frau (vor Stunden) → Erwachen im dunklen Zimmer (jetzt). Es gibt kein "Rückblende"-Label und kein Aufwachen im Wald. Konkret:
- Nach "Ein Fiebertraum." kommt das Jagdhorn, und der Traum *fällt weiter*: Die Flucht ist noch Fieber, erkennbar an einer feinen, langsam atmenden Randunschärfe, die sich durch die gesamte Flucht zieht.
- Sturz auf dem glitschigen Stein → Schwarz → die Stimmen von Frau und Mann → das verschwommene Gesicht der Frau, "Habt keine Angst …" → Schwarz. (Das entspricht dem kurzen Erwachen auf Roman-S. 2/3.)
- Dann **erstes wirkliches Erwachen**: Die Randunschärfe ist weg, das Bild ist zum ersten Mal im ganzen Prolog vollständig scharf. Dunkles Zimmer, schweißgebadet (Roman S. 4). Das ist ein bewusster Bildkontrast und markiert die Gegenwart.
- Das Echo der letzten Spieleraktion bleibt, wird aber auf **höchstens eine Sekunde** gekürzt und sitzt unmittelbar vor diesem Erwachen: ein einziges entsättigtes Aufblitzen seines Strahls oder seiner Druckwelle, dann öffnen sich die Augen.
- Die Kerze ist beim Erwachen erloschen ("Es war dunkel im Zimmer", S. 4). Das Bernstein gehört zur Szene mit der Frau; das dunkle Zimmer wird nur vom Mondlicht durchs Fenster und später vom Blau an Valentus' Hand erhellt. Der Style-Frame der Wiege darf trotzdem eine Kerze zeigen – im Spiel brennt sie dann nur in der Szene mit der Frau.

## Was ich in Bildern NICHT sehen will

Generische Fantasy-Mittelalterkulisse mit Burg im Hintergrund, Comic-Proportionen, leuchtende Runen auf Feinden, Schattenmonster, Zauberstab für Valentus, Rüstung für Valentus, erfundene Wappen, Neon-Effektfarben, freundliche Frühlingswiesen in der Schlacht, Valentus als glatter Anime-Schönling oder als generischer Graubart-Zauberer.

## Figurenlook nach Filmvorgabe (ersetzt frühere Aussehensangaben in diesem Dokument)

Nutzervorgabe: Das Aussehen folgt den Filmen (siehe `docs/valentus-film-look.md`, `docs/character-film-reference.md`, `docs/heraldry-reference.md`). Handlung bleibt Roman.

- **Valentus (Schlacht):** schmales, ernstes Gesicht, langes dunkelbraunes bis fast schwarzes Haar mit Mittelscheitel bis auf die Brust, schmaler kurzer Kinnbart. Lange **dunkelblaue** Robe mit sehr weiten Ärmeln, breite helle (gebrochen weiße) Vorderbahn und schmaler heller Längsstreifen von der Schulter abwärts, dunkler Gürtel mit großer ovaler Schnalle, helle runde Zierelemente am Halsausschnitt. Kein Stab, keine Rüstung, kein Geistleuchten. Er wirkt nicht alt, sondern **ausgezehrt, ernst, gewaltig** – eine Gestalt, die im Wind steht wie ein Pfahl.
- **Valentus (Flucht):** derselbe Mann unter dickem, dunklem, zerschlissenem Kapuzenmantel; unter der Kapuze dunkle Haarsträhnen; Blut rechts unter den Rippen; schwer beschlagene Schnabelstiefel.
- **Valentus (Zuflucht):** ohne Mantel, Robe geöffnet bzw. Hemd, dicker Verband um den Bauch.
- **Lia (Hof):** Film-Triss: hellbraunes bis dunkelblondes Haar mit goldenen Lichtern, seitliche Flechtsträhnen nach hinten gebunden, weiße geraffte Bluse mit weiten Ärmeln, langer beige-senfgelber Rock, dunkler geflochtener Gürtel. Beim Lesen barfuß, braunes Lederbuch.
- **Dunkelschatten:** gewöhnliche Fußsoldaten, dunkle Kleidung mit **schwarz-weißen** Wappenröcken, Kettenhauben/Lederhelme, Äxte, Spieße, Schilde, Armbrüste. Menschen, keine Monster.
- **Verbündete (der Junge, der Falke):** hell und blau-weiß gekleidete Truppen. Der Junge: einfacher gesteppter Waffenrock, kein Helm (verloren), zu jung für seine Ausrüstung. Der Falke: zwei Kurzschwerter, blau-weiße Kleidung.
- **Banner (verbindlich, Film Folge 1, 00:50):** Dunkelschatten-Seite: schwarz-weiß geviertelt mit dunklem Zentralzeichen. Verbündete: blau-weiß radial gestreift mit grauem geflügeltem Zentralzeichen (Tierart offen lassen).
- **Retterin:** lange rötliche Locken, langes braunes Kleid, grüne Augen (Roman S. 2).

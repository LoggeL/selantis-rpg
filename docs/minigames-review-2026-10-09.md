# Minispiele – Bestandsaufnahme und Urteil (2026-10-09)

Anlass: Nutzer-Feedback „Allg sind die Minigames sehr langweilig. Vllt anpassen oder jeweils entfernen. Nur kreative
minigames.“ und „Die Animation beim Minispiel Augen öffnen zeigt immer die gleiche Szene.“

Maßstab: Ein Minispiel bleibt nur, wenn es eine **echte Entscheidung oder Idee** enthält, die aus der Story-Situation
kommt (Beobachtung, Lias Belesenheit, Hinweise kombinieren, Timing mit Bedeutung, Folgen). Reines „Regler schieben /
Taste halten / Balken füllen / Ring treffen“ fliegt raus oder wird umgebaut. Der Story-Beat, gesetzte Flags, Items und
`prepare()`-Verträge bleiben in jedem Fall erhalten.

Urteile: **behalten** · **umbauen** (konkrete Idee) · **entfernen** (durch Inszenierung ersetzen: Erzählzeile, Tafel,
Licht/Kamera, Geräusch).

Ausnahme laut Nutzer: **„Augen öffnen“ bleibt**, zeigt aber pro Aufruf das passende Bild (siehe Abschnitt
„Augen öffnen“ am Ende).

## Überblick in Zahlen

- 83 interaktive Momente erfasst (inkl. Schleich- und Spurenpassagen auf der Karte, damit nichts fehlt).
- **behalten: 45**, davon 7× „Augen öffnen“ (bekommt pro Szene ein eigenes Bild) und 1× vereinfachen (Sammlung).
  Die meisten davon sind Deduktion, Spurenlesen, Wissensfragen und Schleichen auf der Karte – das funktioniert.
- **umbauen: 18** – vor allem Reaktions-Ringe, Timing-Nadeln, Regler, „still halten“-Balken und die Busch-Challenges.
- **entfernen: 19** (1× teilweise) – fast alle reinen Schieber-Gesten (`reach`/`lift`/`tend`/`bellows`) außer „Augen
  öffnen“, sowie „Sanft pusten“, die Kap.-1-Deckung und das Kerzen-Hinterherlaufen.
- 2 Taktikkämpfe außerhalb dieser Prüfung.
- Von den 30 Gesten-Aufrufen bleiben 7 („Augen öffnen“), 7 werden zu etwas mit Inhalt, der Rest wird Inszenierung.

## Prolog und Teil I (Kapitel 1–5)

| Ort / Szene | Minispiel | Urteil | Begründung | Konkrete Umbauidee / Ersatz |
|---|---|---|---|---|
| Prolog · `prolog-schlacht` (Höhle, `schlacht.ts:254`) | Geste `reach` „Die Hand ausstrecken“ – Griff nach rechts schieben, eine Bewegung | **entfernen** | Reiner Schieber ohne Entscheidung; die Höhle-Tafel und der türkise Lichtblitz tragen den Moment allein. | Tafel `prolog-hoehle` hält länger, Valentus' Satz, dann Kamerafahrt aufs Licht + Blitz (bestehende Fades). Kein Flag betroffen. |
| Prolog · `prolog-flucht` (Weltkarte) | Nächtliche Flucht: Fackelträger mit Sichtkegeln, Hunde folgen der Witterung bis zum Bach | **behalten** | Echte Idee: Spur im Wasser verwischen, Weg wählen. Kein Overlay-Minispiel. | – |
| Prolog · `prolog-zuflucht` (Wiege, `zuflucht.ts:145`) | Geste `lift` „Die Hand heben“ – eine Bewegung nach oben | **umbauen** | Schieber ohne Inhalt, aber der Moment trägt eine schöne Wendung. | **„Wem gebe ich sie?“**: Valentus hält die Urmacht über zwei Wiegen; der Spieler wählt per Klick/Taste ein Kind (Lia oder Kyra, Namen noch ungenannt: „das stille“ / „das, das schreit“). Das Licht senkt sich – und teilt sich mitten im Fall von selbst auf beide. Valentus: eigene Zeile des Erstaunens. Gewählte Wiege als Flag (`prolog-wiege-wahl`) für eine spätere Rückblende-Zeile. Bilder: bestehende Tafel `prolog-wiege` + Licht-Effekte im Code. |
| Kapitel 1 · `ueberfall` (`ueberfall.ts:170, 247`) | Challenge `cover` „In der Böschung verstecken“, 2× – Lia zum markierten Busch schieben, während die Wache sucht stillhalten | **entfernen** | Reines Hin-und-her-Timing mitten in der Verhör- und Mordszene; zieht den Spieler aus dem stärksten emotionalen Moment. Das Schleichen in der Böschung ist davor und danach schon auf der Karte spielbar. | Inszenieren statt spielen: Lia will losrennen („Ich muss zu ihr!“), ein Ast knackt unter ihrem Knie, die Kapuze bzw. der Kahle dreht sich, Kamera-Zoom auf das Gebüsch, Lia hält den Atem (Herzschlag-Sfx) – dann „Nur ein Fuchs“. Die vorhandenen Reaktionszeilen (`s1`/`s2`-Zweige) werden fest abgespielt. |
| Kapitel 1 · `ueberfall` Hohlweg (`ueberfall.ts:360`) | Challenge `duck` „Unter den Reitern abtauchen“ – 3 Runden runter/hoch | **umbauen** | Das „kurz hochsehen“ hat Bedeutung, ist aber nur ein Schieber. | **„Hinsehen“**: Die Reiter ziehen in Gruppen vorbei; zwischen den Gruppen darf Lia durch die Zweige spähen und sieht pro Blick genau ein Detail (Anzahl der Pferde, das Zeichen auf den Satteltaschen, Kyra gefesselt beim Grauhaarigen, die Richtung nach Osten). Wer im falschen Moment hochsieht, wird fast entdeckt (Wiederholung des Abschnitts). Die gesehenen Details werden als Hinweise gespeichert und zahlen in Kapitel 2 (`strasse`, Hufspuren-Überlegung „Zehn. Es waren zehn.“ / Richtung) als zusätzliche Argumente aus. Gemalte Bühne `stealth-duck` bleibt. |
| Kapitel 1 · `trauer` (Weltkarte) | Steine für zwei Gräber tragen, je Stein eine Erinnerung | **behalten** | Kein Geschicklichkeitsspiel; Trauerarbeit mit Text. | – |
| Kapitel 1 · `trauer` (`packingPanel.ts`) | Packen: begrenzter Platz für Extras (Kräuterlexikon, Alana-Buch, Zunder, Kuchen, Apfel) | **behalten** | Echte Entscheidung mit Folgen (Zunder → Feuer leichter, Lexikon → Spitzwegerich in Kap. 4, Alana-Buch → Leselager). Passt zu Lias Bücherliebe. | Optional später: ein Satz Lias pro Gegenstand, wenn er weggelegt wird. |
| Kapitel 2 · `strasse` (Weltkarte) | Hufspuren/Wegweiser lesen, Lias Überlegung mit Argumentwahl | **behalten** | Deduktion mit Lias trockenen Gegenargumenten – genau die gewünschte Art. | Bekommt durch „Hinsehen“ (Kap. 1) zusätzliche Argumente. |
| Kapitel 2 · `erstes-lager` (`feuer.ts`, `feuerLogic.ts`) | Feuerbohren: Nadel pendelt, im hellen Feld drücken, Hitze füllen; 3 Fehlversuche → heimlicher türkiser Funke | **umbauen** | Klassische Timing-Nadel. Die Folgen (Zunder, Funke `k2-funke`) sind gut, das Spiel selbst nicht. | **„Feuer nach Büchern“**: Lia baut das Feuer aus dem, was sie gesammelt hat (Steinring, Reisig, Späne, Zunder falls gepackt, dicke Äste) und legt es in eine Reihenfolge/Anordnung (Zunderbett unten, Späne locker als Zelt, Windseite zum Felsen). Jede Wahl kommentiert sie mit Buchwissen – manches stimmt, manches ist Abenteuerroman-Unsinn („Bei Riccard reichen zwei Feuersteine und ein Blick“). Falscher Aufbau → Rauch, Glut stirbt, Lias trockener Kommentar. Nach dem dritten Fehlschlag springt weiterhin der türkise Funke über (`k2-funke`). Ohne Zunder fehlt eine Option (schwerer). Das Bohren selbst wird eine kurze Animation. |
| Kapitel 2 · `foltan-azar` (`foltanAzar.ts:72`) | Geste `open-eyes` „Augen öffnen“ | **behalten** (Nutzerwunsch) | Bild passt hier bereits (Foltan und Azar mit Laterne = `k2-geweckt`). | Wird Referenz für die neue Option `backdrop`. |
| Kapitel 2 · `foltan-azar` (`sterne.ts`) | Crios finden: hellster Stern im Westen, falsche Sterne mit Erinnerungen (Wagen, „die Hühner“) | **behalten** | Beobachtungsrätsel mit zwei Hinweisen und Erinnerungen an Vater und Kyra. | – |
| Kapitel 3 · `eber` (`deduce.ts`, `panels.ts`) | Hinweistafel „Lias Notizen“: zwei Hinweise kombinieren → Schluss; widerlegt Foltans „Craupor weiß nichts“ | **behalten** | Kern des gewünschten Typs (Beobachtung + Kombination + Folge im Dialog). | Kleine Verbesserung möglich: falsche Paare bekommen Lias trockene Selbstkorrektur statt stummer Ablehnung. |
| Kapitel 3 · `leselager` (`panels.ts` `blowGame`) | „Sanft pusten“: Atemstärke-Regler in einer wandernden Zone halten | **entfernen** | Regler-im-Feld-Spiel, und inhaltlich eine Wiederholung des Feuers aus Kapitel 2. Die eigentliche Szene (Lia beweist, dass sie lesen kann) beginnt erst danach. | Inszenierung: Azars fünfter Versuch; wenn Lia Zunder hat, die bestehende Wahl „Nimm meinen Zunder“ (`k3-zunder-geteilt`) bleibt, sonst rät Lia mit dem, was sie in Kap. 2 gelernt hat („Nicht pusten wie ein Blasebalg. Wie über heiße Suppe.“). Kurze Glut-Animation, dann `k3-feuer`. |
| Kapitel 3 · `kyra` (`panels.ts` `stakeGame`, `games.ts`) | „Der Pflock“ (als Kyra): im Takt der Trommel des Waffenknechtlieds ziehen; in Trinkpausen nicht; Lärm lässt Algard hersehen | **umbauen (leicht)** | Hat schon eine Idee (das Lied deckt den Lärm), spielt sich aber als Metronom-Tippen über viele Takte. | **„Das Lied lesen“**: Statt jedes Schlags zählen nur die laut gegrölten Stellen (Refrainzeile „Das ist das Leben als Waffenknecht!“, Becherstoßen, Gelächter). Kyra kennt die Strophen nach dem ersten Durchgang; der Spieler lernt den Aufbau des Lieds und zieht in wenigen, großen Momenten – dazwischen Algard beobachten (wer ist betrunken genug, wer schaut her). Weniger Eingaben, jede bedeutsam; der Text des Lieds wird so zum Rätsel. |
| Kapitel 3 · `kyra` (Weltkarte) | Kyra schleicht zum Zelt (Kette klirrt beim Rennen), Spähen durch die Plane (Wahl) | **behalten** | Gute Spielidee (Kette, Kyra kann nicht lesen). | – |
| Kapitel 4 · `augenbinde` Bach (`augenbinde.ts:110`) | Geste `tend` „Die Ferse versorgen“ – 3× hin und her, nur nach Wahl „Mutters Tinktur“ | **entfernen** | Die Wahl davor (Tinktur / Spitzwegerich aus dem Lexikon / kaltes Wasser) ist schon das eigentliche Spiel; das Streichen danach ist Füllstoff. | Nach der Wahl direkt Sfx + Lias Gedanke „Autsch. Mutter hat dabei immer gepustet …“. |
| Kapitel 4 · `augenbinde` Waldpfad (`blindfold.ts`) | Blind gehen: dunkler Schirm, Azars Stimme in Stereo, Ringe zeigen Geräuschquellen, Stamm ducken, Bach meiden | **behalten** | Kreativ, aus der Situation geboren (Binde), Orientierung nach Gehör. | – |
| Kapitel 4 · `bruderschaft` Schmiede (`bruderschaft.ts:300`) | Geste `bellows` „Blasebalg treten“ – 6 Hübe | **entfernen** | Sechsmal hoch/runter ohne Idee; Azars Willkommen ist ein Gesprächsmoment. | Inszenierung: Lia tritt, Funken (vorhandene `fx.burst`/Licht `esse`), Azars Spruch. |
| Kapitel 4 · `bruderschaft` Training (`training.ts` `ausweichDrill`) | Ausweichen: Foltan schlägt links/rechts/hoch, Lia weicht zur Gegenseite aus, Finten | **umbauen** | Reaktionsspiel mit Pfeilen; dieselbe Mechanik wie der Ghul-Ring in Kap. 5. Lehrt die Fähigkeit `ausweichen`. | **„Foltans Gewohnheiten“**: Lia ist nicht schnell, aber sie beobachtet. Foltan schlägt Folgen nach Mustern (nach einem hohen Hieb immer links, vor einer Finte zuckt die Schulter, er tritt vor dem Stich auf den rechten Fuß). Runde 1: Lia steckt ein und notiert (Kommentare im Notizstil); danach sagt der Spieler den nächsten Hieb vorher und wählt die Ausweichrichtung *bevor* er kommt. Foltan merkt es, wird ärgerlich und ändert ein Muster – Lia muss es neu lesen. Gelernt: `ausweichen` (Flag/Fähigkeit bleibt). Bilder: vorhandene `k4-drill-*`. |
| Kapitel 4 · `bruderschaft` Training (`ablenkDrill`, `gundrikAblenken`) | Ablenken: Stein auf das richtige Ziel werfen, Gundrik mit Worten ablenken (Wahl) | **behalten** | Kleine Denkaufgabe mit Witz, passt zur Figur. | – |
| Kapitel 4 · `verrat` (Weltkarte) | Durch das Lager zum Zelt schleichen | **behalten** | Kein Overlay; Schleichen mit Sichtkegeln. | – |
| Kapitel 5 · `regenwald` (`dodge.ts`, `regenwald.ts:191`) | „Ausweichen!“: Ring schließt sich, im goldenen Bereich drücken, 3 Treffer nötig | **umbauen** | Reiner Reaktions-Ring. Der Moment (Lia allein, unterlegen, Flick rettet sie) verdient mehr. | **„Drei Atemzüge“**: Bei jedem Ausholen zeigt das Bild die Umgebung (Wurzelbogen, glitschiger Hang, Lias nasser Mantel, Baumstamm). Der Spieler entscheidet, was Lia tut: unter die Wurzel ducken (die schartige Axt bleibt im Holz hängen), den nassen Mantel über die Knochenmaske werfen, den Hang hinunterrutschen. Jede Wahl passt nur zu einer Ausholbewegung (weit seitlich vs. hoch über dem Kopf) – man muss hinsehen. Fehler = Kratzer (`k5-ghul-treffer` bleibt Zähler). Am Ende immer Flicks Pfeil; ihre erste Zeile richtet sich nach Lias Einfall („Mantel über den Kopf? Nicht schlecht, Bauernmädchen.“). |
| Kapitel 5 · `faehrte` (Weltkarte) | Spurenlesen an zwei Gabelungen, Sackgassen kosten Tageslicht | **behalten** | Beobachtung mit Folgen. | – |
| Kapitel 5 · `schattenlager` Erkundung (Weltkarte) | Drei Aussichtspunkte erkunden, Patrouillen mit Sichtkegeln | **behalten** | Schleichen auf der Karte, kein Overlay. | – |
| Kapitel 5 · `schattenlager` (`schattenlager.ts:166`) | Challenge `listen` „Im Schatten lauschen“ – zwischen zwei Stämmen wechseln, bevor die Fackel kommt | **umbauen** | Kommt *nach* dem belauschten Gespräch und ist dadurch reines Hin-und-her; inhaltlich leer. | **„Wortfetzen“**: Das Gespräch Baris/Orwen/Wachen läuft *während* des Spiels. Am Feuer knackt und lacht es; Lia hört nur Bruchstücke, je nachdem, hinter welchem Stamm sie steht (näher = mehr Worte, aber im Fackellicht). Danach setzt der Spieler im Gespräch mit Flick zusammen, was sie gehört hat (Wie viele Wachen bleiben? Wohin reiten der Hüne und der Grauhaarige? Was ist Kyra wert?). Richtige Antworten geben Flick bessere Argumente und +1 Ablenkungspunkt (`k5-ablenkung`) für den Bluff. |
| Kapitel 5 · `schattenlager` Bluff (`bluff.ts`) | Bluff am Wachfeuer: Antwortwahl, Gegenstände abgeben, Punkte 0–3 bestimmen die Rettung | **behalten** | Entscheidungen mit klaren Folgen, Lias Mundwerk. | – |
| Kapitel 5 · `rettung` | Taktikkampf an der Eiche | (außerhalb) | Taktik, nicht Teil dieser Prüfung. | – |

## Teil II

| Ort / Szene | Minispiel | Urteil | Begründung | Konkrete Umbauidee / Ersatz |
|---|---|---|---|---|
| `e2-taverne` (`taverne-route.ts`) | Drei Quellen befragen, dann aus vier Routen die richtige ableiten (Korrekturen von Flick/Kyra) | **behalten** | Echte Deduktion mit belegten Argumenten. | – |
| `e2-bruderschaft` (Weltkarte) | Kerben mit Spurenblick lesen, Gabelung richtig wählen | **behalten** | Beobachtung auf der Karte. | – |
| `e2-pruefung` (`pruefung.ts:119`) | Geste `lift` „Die Schale an die Lippen heben“ (ohne Bild) | **entfernen** | Die Entscheidung (selbst trinken, `e2-pruefung-wahl`) fällt davor; der Schieber ist Füllstoff. | Lias Satz „Ich trinke. Nicht weil er es will …“, Schluck-Sfx, kurzer Schnitt. |
| `e2-pruefung` (`pruefung.ts:151`) | `hold` „Dich selbst festhalten“ (Kampfmodus, 4,2 s Taste halten, Herzschlag) | **umbauen** | Taste halten ist der Inbegriff von „langweilig“ – aber der Satz des Druiden („halt dich an dir selbst fest, an nichts anderem“) ist eine fertige Spielidee. | **„Woran hältst du dich?“**: Im Licht-Sturm wirbeln Bilder/Worte um Lia – Dinge, die *sie selbst* sind (die Eiche, unter der sie liest; Mutters Handschrift; „Leseratte“; ihr Name) und Dinge von außen (Kyras Hand, Foltans Blick, Elnons Befehl, die Schale). Der Spieler greift drei Anker; wer nach außen greift, dem entgleitet das Licht (Stoß, Rebellen fliegen – Story läuft trotzdem weiter, nur Lias Gedanke danach ändert sich). Bereitet die „Sammlung“ (`e2-konzentration`) vor. Keine neue Grafik nötig: Worte als Licht-Schrift über der Szene. |
| `e2-flicks-herkunft` (Weltkarte) | Flicks Spuren zum Wachturm lesen | **behalten** | Kurze Spurensuche, kein Overlay. | – |
| `e2-lagerangriff` (Welt + Taktik) | Säbel für Azar holen, Foltan den Weg sagen (beeinflusst Kampf), Taktikkampf, Flucht am Bach | **behalten** | Entscheidungen mit Folgen; Kampf außerhalb dieser Prüfung. | – |
| `e2-der-fremde` (`der-fremde.ts:99`) | Geste `open-eyes` „Die Augen öffnen“ | **behalten + Bild** | Zeigt bisher Foltan und Azar (`k2-geweckt`). | Neues Bild: Unterstand auf Ignatius' Lichtung, Abenddämmerung, der Fremde summend am Feuer, sonst niemand (siehe Abschnitt „Augen öffnen“). |
| `e2-der-fremde` | Wackliger Gang, zweimal zusammenbrechen | **behalten** | Erzählerische Steuerung, kein Minispiel. | – |
| `e2-der-fremde` (`der-fremde.ts:219`) | Geste `lift` „Den Becher an die Lippen heben“ (ohne Bild) | **entfernen** | Kein Inhalt. | Narration „Die Hände zittern noch.“ + Schluck-Sfx. |
| `e2-gefangene` (als Flick) | Vier Beobachtungen in Kettenreichweite, Schlüssel nur im richtigen Moment der Patrouille | **behalten** | Beobachten und Abwarten mit Bedeutung. | Später als Grundlage für `e2-flick-entkommt` nutzen (s. u.). |
| `e2-urmacht` (`urmacht-wissen.ts`) | Xenovia-Wissensfragen; Buchwissen aus Teil I wird als Marke angezeigt | **behalten** | Lias Belesenheit als Spielmechanik – genau richtig. | Optional: `e2-urmacht-vorwissen` später für eine Zeile Ignatius' nutzen. |
| `e2-flicks-verhoer` (als Flick) | Nagel nur in unbeobachteten Fenstern bearbeiten | **behalten** | Timing mit Bedeutung (Baris' Blick). | – |
| `e2-flicks-verhoer` (`flicks-verhoer.ts:78`) | Geste `reach` „Den losen Nagel lockern“ | **entfernen** | Der Fenster-Moment ist das Spiel, die Geste danach Füllstoff. | Die zweite Interaktion im Fenster löst direkt die Nagel-Nahaufnahme (vorhandenes `NAIL_PICTURE`/Glint als Standbild 1,5 s) + Sfx aus. |
| `e2-konzentration` (`konzentration-game.ts`) | „Sammlung“: Licht in der Mitte halten, vorbeiziehende Gedanken nicht greifen, im vollen Atem ausatmen | **behalten (vereinfachen)** | Die Idee („Gedanken nicht festhalten“) ist kreativ und thematisch stark; die Steuerung ist fummelig. | Steuerung entschlacken: Licht bleibt von allein in der Mitte, nur die Gedanken ziehen; der Spieler entscheidet bei jedem Gedanken „ziehen lassen“ oder „festhalten“ und atmet im richtigen Moment aus. Weniger Lenken, mehr Entscheiden. |
| `e2-flicks-erinnerungen` (`flicks-erinnerungen.ts:85`) | Challenge `cover` „Die Erinnerung verschließen“ (Leseratte im Wald hinter Büsche ziehen) | **umbauen** | Schöne Idee (Flicks Kopf als Wald, Vamir sucht), aber nur das Busch-Hin-und-her aus Kap. 1. | **„Falsche Fährten“**: Vamir blättert in Flicks Erinnerungen und fragt nach. Flick bietet ihm statt Lia andere, wahre, aber harmlose Erinnerungen an (die Ein-Frau-„Elfen von Grunwald“, ein gestohlener Kuchen, der Rauswurf bei den Rebellen). Jede Antwort muss zur Frage passen, sonst hakt Vamir nach („Ein Buch? Wer liest denn bei euch?“). Drei Fragen; Ergebnis wie bisher (Rascheln oder „Nichts. Blätter.“). Bild: Tafel `e2-erinnerung` als Hintergrund. |
| `e2-kyras-widerstand` (als Kyra, `kyras-widerstand.ts:52`) | Geste `tend` „Am Knoten zupfen“ (wird immer bemerkt) | **entfernen** | Feststehender Ausgang, Schieber ohne Wahl. | Interaktion im Fenster + Knoten-Nahaufnahme als Standbild, dann der bestehende „bemerkt“-Beat. |
| `e2-ignatius` Nacht (`ignatius.ts:152`) | Geste `open-eyes` „Aufwachen“ nach dem Traum | **behalten + Bild** | Zeigt bisher Foltan und Azar. | Neues Bild: Unterstand bei Nacht, violetter Nachglanz des Traums an den Rändern, Ignatius am Feuer. |
| `e2-ignatius` Morgen (`ignatius.ts:328`) | Geste `reach` „Den Stab nehmen“ | **entfernen** | Tafel `e2-schattentoeter` trägt den Moment; Geste ohne Wahl. | Tafel länger, Lias Satz, Item wie bisher (`grantOnce`). |
| `e2-ignatius` Nachtweg (Weltkarte) | Spuren von Ignatius lesen, falsche Fährte (Lias eigene Spuren) | **behalten** | Beobachtung mit Pointe. | – |
| `e2-zellengespraeche` (als Flick) | Routine der Wärter beobachten (Phasen) | **behalten** | Muster erkennen. | – |
| `e2-zellengespraeche` (`zellengespraeche.ts:219`) | Geste `tend` „Das Schloss mit dem Nagel öffnen“ + Wahl, wie die offene Schelle versteckt wird | **teilweise entfernen** | Zeitfenster und Versteck-Wahl sind gut, die Geste dazwischen nicht. | Geste raus, Standbild `PICK_PICTURE` + Klick-Sfx; Fenster-Regel und Wahl `e2-zelle-schelle` bleiben. |
| `e2-stabtraining` (`stabtraining-zielen.ts`) | Ziele nach Ignatius' Beschreibung wählen, verbotene Nachbarn meiden | **behalten** | Zuhören und Entscheiden („Entscheidung vor Kraft“). | – |
| `e2-flick-entkommt` (`flick-entkommt-moment.ts`) | Ring-Timing „Losreißen!“ / „Zuschlagen!“ | **umbauen** | Reiner Reaktionsring (wie Kap. 5). | **„Was du gesehen hast“**: Der Wärter beugt sich über die Schelle. Flick wählt, was sie tut – und nur, was sie vorher in der Routine (`e2-zellengespraeche`) und in Kettenreichweite (`e2-gefangene`) beobachtet hat, funktioniert (Schlüssel hängt links am Gürtel, er dreht sich beim Husten weg, das Stroh verdeckt die Schelle). Jede unbeobachtete Option bleibt sichtbar, aber Flick sagt trocken, warum sie nicht klappt. Kein Scheitern, aber Beobachten zahlt sich aus. |
| `e2-flick-entkommt` (Weltkarte) | Schleichweg zur Treppe | **behalten** | – | – |
| `e2-kontrolle` (als Elnon) | Kyra dreimal ansprechen (absichtlich vergeblich), Kette ziehen | **behalten** | Gewollte Ohnmacht über Dialog, kein Geschicklichkeitsspiel. | – |
| `e2-aufbruch` (Weltkarte) | Flick 15 s im Farn unentdeckt | **behalten** | Kurz, ohne Overlay. | – |

## Teil III (nur Vorschläge – Umsetzung durch die Teil-III-Lane)

| Ort / Szene | Minispiel | Urteil | Begründung | Konkrete Umbauidee / Ersatz |
|---|---|---|---|---|
| `e3-valentus` (`valentus-spur.ts`) | Lichtpunkte per Spurenblick zu einer Linie ziehen | **behalten** | Entdecken statt Fummeln. | – |
| `e3-eigener-stab` (`eigener-stab-geister.ts`) | Lichtgeister langsam zur Weide führen (Rennen verscheucht) | **behalten** | Thema „Ruhe statt Kraft“ als Bewegungsregel. | – |
| `e3-eigener-stab` (`eigener-stab.ts:187`) | Geste `reach` „Nach dem hellen Ast greifen“ | **entfernen** | Tafel `e3-eigener-stab` trägt den Moment. | Tafel + Lias Gedanke; `receiveOwnStaff()` unverändert. |
| `e3-eigener-stab` (`zielen.ts`) | Erster Stabstrahl: Samenkapseln treffen, ruhende Geister und Bach meiden | **behalten** | Zielwahl mit Urteil. | – |
| `e3-paladine` (`paladine-regeln.ts`) | Tarngeschichte: Antworten aus Ignatius' Einweisung wiederholen | **behalten** | Gedächtnis + Logik. | `e3-tarnung` wird nirgends gelesen – eine spätere Zeile würde es belohnen. |
| `e3-paladine` | Geleit durch Trapas / Leine an der Schmiede | **behalten** | Bewegung, kein Minispiel. | – |
| `e3-schutzreaktion` (`schutzreaktion.ts:186`) | Geste `reach` „Sich losreißen“ | **entfernen** | Ausgang fest; die Schutzreaktion ist die Pointe. | Kamera-Ruck, Griff-Sfx, sofort Tafel `e3-schutzreaktion`. |
| `e3-macht-und-schutz` (`:158`) | Geste `open-eyes` | **behalten + Bild** | Zeigt bisher Foltan und Azar. | Gastzimmer im Ordenshaus, Tag, Lia gefesselt auf dem Bett, der Doktor am Tisch mit Instrumenten. |
| `e3-macht-und-schutz` (`:200`) | Geste `reach` „Die Hände auf den Kristall legen“ (es passiert nichts) | **entfernen** | „Nichts passiert“ ist als Schieber wertlos, als Inszenierung gut. | Hände auf dem Kristall (Standbild `crystalPicture`), Stille, Doktor: trockene Notiz. |
| `e3-macht-und-schutz` (`stepStill`) | Schale: 2,4 s still in Deckung hocken (Balken) | **umbauen** | Balken füllen. | **„Woran denkst du?“**: Der Doktor lässt Lia über eine Wasserschale die Hände halten; das Wasser zittert mit ihrem Gemüt. Der Spieler wählt nacheinander, woran Lia denkt (Mutters Küche, das Alana-Buch, Kyra auf dem Hügel, Vamirs Halle). Ruhige Erinnerungen glätten das Wasser, Angst/Wut lassen es kochen. Der Doktor notiert, *was* sie beruhigt – Zeile später nutzbar. |
| `e3-macht-und-schutz` (`stepFollow`) | Kerze: 7 s nah beim Doktor bleiben | **entfernen** | Hinterherlaufen ohne Idee. | Doktor geht seine Runde als Kamera-Szene, Lia kommentiert. |
| `e3-falscher-glaube` (Welt) | Nachts schleichen, Buch lesen, an der Tür lauschen und bei Wachgang in den Schatten | **behalten** | Gutes Schleichen mit Ziel. | – |
| `e3-kyras-fluchtweg` (Keller) | Schleichen von Schatten zu Schatten | **behalten** | – | – |
| `e3-kyras-fluchtweg` (`:365`) | Geste `reach` „Die Steigeisen hinunter“ | **entfernen** | Kein Inhalt. | Tafel `e3-schacht` + Tropf-/Eisen-Sfx. |
| `e3-waldgegner` (als Flick, `:136`) | Geste `tend` „Den Strick am Stein reiben“ ×2, nur wenn keiner hinsieht (Wachzyklus) | **umbauen** | Der Wachzyklus ist das Spiel, die Geste nicht. | **„Wer schaut?“**: Geste raus. Flick lernt die Gewohnheiten der drei (der Lange popelt, der Anführer schaut nach jedem Lacher, Ratze nach jedem Bissen) und reibt per Tastendruck nur in freien Momenten; jede Reibung im freien Moment = Fortschritt, im beobachteten = Rückschlag + Bark. Wie der umgebaute Pflock (Kap. 3), wiederverwendbar. |
| `e3-vertraute-schwester` (`:217`) | Geste `lift` „Den Becher an die Lippen heben“ (Gift) | **umbauen** | Kanon: Lia trinkt. Die Geste verschenkt den Moment. | **„Übersehene Zeichen“**: Vor dem Trinken darf der Spieler Becher und „Kyra“ ansehen (Rindengeruch, sie trinkt selbst nicht, ihre Augen bleiben kalt). Lia redet sich jedes Zeichen weg; trinken ist Pflicht. Gefundene Zeichen zahlen in `e3-falle` als bittere Zeile aus („Ich hab's gerochen. Und trotzdem getrunken.“). `e3-vergiftet` unverändert. |
| `e3-vertraute-schwester` (`:317`) | Geste `open-eyes` | **behalten + Bild** | Zeigt bisher Foltan und Azar. | Waldrast am Morgen, Feuer zu Asche, „Kyra“ steht kalt über Lia. Nebenbefund: Karte steht auf `time: 'night'`, obwohl es Morgen ist. |
| `e3-falle` (Welt) | Lager mit Spurenblick absuchen; Falle schnappt beim dritten Fund oder früher | **behalten** | Echte Entscheidung mit Spannung. | – |
| `e3-falle` (`:267`) | Geste `reach` „Nach Kyras Hand greifen“ (Kyra weicht zurück) | **umbauen (Baustein)** | Die Vergeblichkeit ist der Inhalt – das kann die Geste zeigen. | **„Zurückweichen“**: Neuer Gesten-Modus, in dem der Zielring zurückweicht, sobald der Griff ihn fast erreicht; nach zwei Versuchen bleibt Lias Hand in der Luft. Baustein in `game/src/ui` (Option z. B. `{ recede: true }`). |
| `e3-innere-zuflucht` | Drei Erinnerungen im Nebel aufsuchen | **behalten** | Erkundung, liefert Material für die Risse (s. u.). | – |
| `e3-flicks-hilfe` (als Flick, `:198`) | Geste `tend` „Die Hände im Seil drehen“ ×3, Wolfsaugen kommen näher (nur Optik) | **umbauen** | Die Wölfe sind eine Idee, die nichts bewirkt. | **„Glut oder Seil“**: Zwischen den Drehungen rücken die Augen näher. Flick entscheidet jedes Mal: weiter am Seil drehen oder mit dem Fuß Glut in Richtung der Augen kicken. Zu oft Seil → Wolf knurrt nah (Schreck, Rückschritt); zu oft Glut → Feuer wird klein. Drei Drehungen nötig. |
| `e3-flicks-hilfe` (`:446`) | Geste `reach` „Den Stab nehmen“ | **entfernen** | Kein Inhalt. | Standbild `STAFF_PICTURE` + Flags wie bisher. |
| `e3-hoffnung-und-weigerung` (`hoffnung-riss.ts`) | Drei Risse: 2,4 s still im Ring stehen | **umbauen** | „Stillstehen und warten“. | **„Gegen den Riss“**: Jeder Riss flüstert einen Zweifel in Vamirs Ton („Niemand kommt.“ / „Du bist nur ein Bauernmädchen.“ / „Kyra gehört schon mir.“). Lia schließt ihn mit der passenden Erinnerung aus `e3-innere-zuflucht` (die drei Nebel-Erinnerungen werden so zum Werkzeug). Falsche Erinnerung → Riss weitet sich kurz, neue Wahl. Der vierte Riss bleibt gescriptet. |
| `e3-hoffnung-und-weigerung` (`:246`) | Geste `open-eyes` | **behalten + Bild** | Zeigt bisher Foltan und Azar. | Vamirs Halle bei Nacht, Kohlebecken, Lia kniend am Bodenring, Vamir vor ihr, violettes Licht. |
| `e3-ritual` (`:150`) | Geste `open-eyes` | **behalten + Bild** | Zeigt bisher Foltan und Azar. | Auf dem Stein, Dämmerung, Fackeln, verhüllte Gestelle, Vamir, Baris, die gebannte Kyra. |
| `e3-ritual` (`:170`) | Geste `reach` „Nach Kyra greifen“ (Kyra sieht durch sie hindurch) | **entfernen** | Doppelt mit `e3-falle`. | Standbild + Lias Gedanke. |
| `e3-ritual` (Welt) | Posten mit Spurenblick zeigen; Aufstiegswahl (beeinflusst Kampf) | **behalten** | Wahl mit echter Folge (`e3-ritual-weg`). | – |
| `e3-ritual` (`:341`) | Geste `lift` „Den Bogen spannen“ („Der mit dem Speer zuerst“) | **umbauen** | Zielen wird als Schieber gespielt. | **Zielwahl** mit dem vorhandenen Zielen-Baustein (`zielen.ts`/`stabtraining-ziele`): Flick wählt den ersten Pfeil unter den Wachen; Ignatius' Hinweis („der mit dem Speer“) und eigene Beobachtung der Posten entscheiden. Falsche Wahl = Flicks Fluch + kurzer Nachteil (nur Text, kein Kampfeingriff). |
| `e3-vamir` (`:159`) | Geste `lift` „Den Stab heben“ (immer zu spät) | **umbauen (Baustein)** | Das „zu spät“ ist der Inhalt. | **„Gift in den Gliedern“**: Neuer Gesten-Modus, in dem der Griff träge hinter der Eingabe herzieht (`{ sluggish: true }`); Vamirs Schlag kommt, bevor er oben ist. Der Spieler *spürt* das Gift. |
| `e3-ignatius-abschied` (`:95`) | Geste `tend` „Seine Hand halten“ | **entfernen** | Ein Schieber beim Sterben einer Figur wirkt mechanisch. | Tafel `e3-abschied` bleibt offen, Lia nimmt seine Hand als Bild/Text, danach die Wahl-Momente wie bisher. |
| `e3-ritualangriff`, `e3-vamir` Duell | Taktikkämpfe | (außerhalb) | – | – |

## Augen öffnen – passendes Bild pro Aufruf

Befund: `miniIllustration.ts` lädt für `open-eyes` immer die Tafel `k2-geweckt` (Foltan und Azar mit Laterne).
`restageGesture('open-eyes', …)` in Teil II/III ändert nur den Hilfetext. Dadurch sieht Lia in sechs von sieben
Szenen die falschen Figuren.

Geplante Lösung (Phase 2): `G.ui.storyAction('open-eyes', label, { backdrop, focus?, caption? })`. `backdrop` ist eine
Tafel-ID (`assets/cut/<id>.jpg`) oder ein Kartenhintergrund. Fallback ohne Angabe bzw. bei fehlender Datei: der
Kartenhintergrund der Szene, stark unscharf und dunkel, **ohne Figuren** – lieber nichts Konkretes als die falschen
Leute. `k2-geweckt` wird nur noch in Kapitel 2 ausdrücklich übergeben.

| Aufruf | Szene | Wen Lia sieht / Ort / Zeit | Bild-ID (Vorschlag) | Fallback-Hintergrund |
|---|---|---|---|---|
| `kapitel-2/foltanAzar.ts:72` | `foltan-azar` | Foltan und Azar mit Laterne, Lichtung, Nacht | `k2-geweckt` (vorhanden) | – |
| `teil-2/der-fremde.ts:99` | `e2-der-fremde` | Unterstand aus Ästen, Felle, Bach; der Fremde (Ignatius) summend am Feuer; Dämmerung | `e2-der-fremde-geweckt` | `e2-ignatius-lager` |
| `teil-2/ignatius.ts:152` | `e2-ignatius` (Nacht) | derselbe Unterstand bei Nacht, violetter Traum-Nachglanz am Rand, Ignatius am Feuer | `e2-ignatius-geweckt` | `e2-ignatius-lager` |
| `teil-3/macht-und-schutz.ts:158` | `e3-macht-und-schutz` | Gastzimmer im Ordenshaus (Trapas), Tag; Lia gefesselt im Bett; der Doktor am Tisch | `e3-macht-und-schutz-geweckt` | `e3-gastzimmer` |
| `teil-3/vertraute-schwester.ts:317` | `e3-vertraute-schwester` | Waldrast am Morgen, Asche; „Kyra“ steht kalt über ihr | `e3-vertraute-schwester-geweckt` | `k3-leselager` |
| `teil-3/hoffnung-und-weigerung.ts:246` | `e3-hoffnung-und-weigerung` | Vamirs Halle, Nacht, Kohlebecken; Vamir direkt vor ihr; Lia kniend am Ring | `e3-hoffnung-und-weigerung-geweckt` | `e2-halle` (zu prüfen) |
| `teil-3/ritual.ts:150` | `e3-ritual` | Auf dem Stein, Dämmerung, Fackeln, verhüllte Gestelle; Vamir, Baris, gebannte Kyra | `e3-ritual-geweckt` | `e3-ritualhuegel` |

Die genauen Dateinamen der Grafik-Lane werden vor dem Verdrahten mit `ls game/public/assets/cut | grep geweckt`
abgeglichen. Teil-III-Aufrufe verdrahtet die Teil-III-Lane.

## Wiederverwendbare Bausteine für Phase 2 (in `game/src/ui`)

1. `storyAction`-Option `backdrop` (+ `focus`, `caption`) für `open-eyes`, mit Fallback ohne Figuren.
2. `storyAction`-Modi `recede` (Ziel weicht zurück) und `sluggish` (Griff zieht träge nach) für die beiden
   Teil-III-Momente, in denen das Scheitern der Inhalt ist.
3. Ein kleines „Gewohnheiten/Fenster“-Spiel (Wachrhythmus beobachten, im freien Moment handeln) – geteilt von Pflock
   (Kap. 3) und Strick am Stein (`e3-waldgegner`).
4. Ein Wahl-Overlay „Anker / Erinnerung wählen“ (Wort-Karten über einer Tafel) – geteilt von „Woran hältst du dich?“
   (`e2-pruefung`), „Woran denkst du?“ (`e3-macht-und-schutz`) und „Gegen den Riss“ (`e3-hoffnung-und-weigerung`).

Nebenbefund: `docs/rebuild/ui-guide.md` sagt, `hold()` werde in Storykapiteln nicht genutzt – `e2-pruefung` nutzt es.
Wird mit dem Umbau erledigt.

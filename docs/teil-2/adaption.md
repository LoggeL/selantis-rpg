# Teil II „Letzte Hoffnung“: Adaptionsprotokoll

Hier steht jede Abweichung vom Film, jede neue Verbindung und jede bewusst neutrale Auslassung. Filmbelege mit
Zeitmarke (F2 mm:ss), Roman mit Seite (R S.), Design mit Abschnitt. Quellenbefunde: [Quellenprüfung](quellenpruefung.md).

## Rahmen

| Entscheidung | Art | Begründung |
| --- | --- | --- |
| Teil II als Kapitel `teil-2` (`order: 6`), 18 Szenen `e2-…` | Struktur | Übergangsvertrag; Szenenplan des Handoffs |
| Fortsetzung über eine dritte, ausdrückliche Wahl am Ende von `finale` und in `weiterreise`; bei gesetztem `k5-ende` erscheint die Wahl erneut (ohne Schlusstafel) | Integration | Vertrag: bestehende Abschlusswege bleiben, alte Spielstände erreichen Teil II |
| Lia heißt Lia (Film: Triss); Elnon = Film-Elhon; Baris Hauptmann; kein Vardis | Namen | DESIGN.md §7.2, Handoff |
| Der Meister heißt im Namensband „Der Meister“, bis Ignatius ihn in `e2-ignatius` benennt; danach „Vamir“ | Wissen | Handoff: In Teil eins kennt Lia den Namen nicht |
| Der Fremde heißt „Der Fremde“, bis er sich vorstellt | Wissen | Szenenplan `e2-der-fremde` |
| Zeitangabe „sechzehn Jahre“ statt der Filmangabe „14 Jahre“ (F2 27:33) | Kanon | Spielkalender und Design |
| Gefangenenszenen sind gerahmte Zwischenspiele mit eigener Spielfigur; `G.state.party` bleibt leer | Perspektive | Vertrag: kein unbemerkter Wechsel der Hauptfigur |

## Spieldesign (keine Filmfakten)

| Element | Festlegung |
| --- | --- |
| Rückkehr zum Goldenen Eber (`e2-taverne`) | Der Film zeigt eine unbenannte Taverne (F2 01:30). Der Eber liegt auf dem Weg zum Lager; Lia kennt den Zugang nicht, weil sie mit verbundenen Augen ins Lager kam (Kapitel IV). |
| Lichtstoß | Wer ihn aus der Weiterreise kennt, behält ihn; Ignatius ordnet ihn als Instinkt ein. Sonst lernt Lia ihn in `e2-konzentration`. Nichts wird verlernt. |
| Stabimpuls (`e2-stabimpuls`) | Neue Kampffähigkeit ab `e2-stabtraining`, nur mit Schattentöter: Einzelziel, Reichweite 1–3, kleiner Lichtimpuls, MP-Kosten und Abklingzeit wie Lichtstoß, keine Heilung, kein Teleport, keine Immunität. |
| Schattentöter (`e2-schattentoeter`) | Ignatius' geliehener Stab (F2 28:47). Kein Schadensbonus außerhalb des Stabimpulses. Getrennt von `e3-lia-staff`. |
| Ignatius' Magie | Eine kleine bernsteinfarbene Schlafgeste (F2 13:32 belegt das Einschlafen, nicht die Technik). Keine Heilmagie. |
| Flicks Flucht | Film (Quellenprüfung §6): Handgemenge mit den Wärtern, Schlüsselbund am Boden, keine Magie. Spiel: Flick löst vorher mit einem Nagel aus dem Verhörstuhl heimlich eine Handschelle, schlägt im Gang zu und nimmt den Schlüsselbund; danach Schleichweg. Elnons Bleiben ist seine Entscheidung. |
| Lagerangriff | Film (Quellenprüfung §4): kein Brand, kein Massaker; Flick schickt die Schwestern fort, Kyra drängt Lia zur Flucht und wird gefasst. Spiel folgt dem; der Taktikkampf ist der Weg zum hinteren Bachdurchlass. |
| Schlussbild | Film (Quellenprüfung §7): Wache auf einer Brüstung über Hügelland, keine Stadt; helle Gestalt mit blau-violettem Randleuchten. Spiel: unbenannt, nur Wahrnehmung; Flicks Versteck vor Verfolgern als kurzes Zwischenspiel. |

## Verbleib der Romanbegleiter

| Figur | Spielwelt | Wissen Lias | Wissen des Spielers |
| --- | --- | --- | --- |
| Foltan | hält beim Angriff das Tor und zieht sich mit den Rebellen nach Süden zurück (Adaption) | sieht ihn am Tor kämpfen | Baris meldet in `e2-gefangene`, die meisten Rebellen seien entkommen |
| Azar | wie Foltan | wie Foltan | wie Foltan |
| Alastir | führt die Nichtkämpfer durch den hinteren Ausgang (Adaption) | keines | wie Foltan |

## Offene Kanonfragen

Siehe Abschnitt „Offene Fragen“ in der [Quellenprüfung](quellenpruefung.md); hier ergänzt die Umsetzung, welche
Fragen tatsächlich eine Entscheidung des Nutzers brauchen.

## Gruppe Lager: e2-taverne, e2-bruderschaft, e2-pruefung, e2-flicks-herkunft

| Element | Art | Festlegung |
| --- | --- | --- |
| Zugang zum Lager (`e2-taverne`) | Spieldesign | Drei Quellen im Eber: Craupor (von Flick ausgefragt: Lager nah, Ort unbekannt, Posten weit draußen), ein Fallensteller (Kerben „wie Krähenfüße“ am Bach im Norden), die Schankmaid (Mehlsäcke jeden Morgen nach Norden an der umgestürzten Eiche vorbei). Routenwahl am Tisch mit Quellen-Tags (`taverne-route.ts`, Vitest); falsche Wahl kommentiert Flick, keine Strafe. |
| Wirt (F2 01:30–03:10) | Adaption | Der Filmwirt wird Craupor; er erkennt Lia als „Foltans Begleiterin“ und gibt einmalig Brot und Käse (`e2-proviant`). Der Fallensteller verlangt optional Käse, Bitte oder Kyras Drohung als Preis. |
| Kyra im Eber | Neue Verbindung | Optional: Stalltür (Erinnerung `e2-mem-stalltuer`), Pfeiler-Bark, der Zwerg aus Kapitel III („Wo ist mein Beil?“), die Schankmaid erkennt Kyra (Schminktäschchen aus Kapitel III). |
| Abend im Eber | Adaption | Sie übernachten im Eber und brechen bei Sonnenaufgang auf (Film: unmittelbarer Aufbruch), weil `e2-bruderschaft` bei Tag spielt. |
| Waldposten | Adaption | Karte `k4-waldpfad` wieder benutzt: die Kerben führen zum Bachübergang aus Kapitel IV. Lia fällt zurück, Kyra und Flick laufen vor; an der Gabelung müssen Kerbe oder Fußspuren gelesen werden (sanftes Zurücksetzen statt Strafe). |
| Hinterhalt und Fesseln | Inszenierung | Pfeil in den Boden, Posten treten aus dem Gebüsch, Abblende; danach knien bzw. zerren die drei gefesselt am Ufer (keine Baumrequisite; Pose `struggle`). Augenbinde für den Weg ins Lager wie in Kapitel IV. |
| Elnons Vorwurf | Konkretisierung | „Beim Eid nur die Hälfte erzählt, geschworen, nichts zu verbergen.“ Das Wort „Halbblut“ fällt einmal als Elnons Vorurteil; was Flick genau behauptet hatte, bleibt offen (keine erfundene Herkunftslüge). Elnon erkennt Lia als die, die in der Nacht seines Gesprächs mit Foltan verschwand. |
| Lia redet die drei frei | Spieldesign | Drei Antworten (Lauschen zugeben, Baris ohne Axt, Kyra lebt); Flag `e2-posten-wahl`. Alle führen zum Losbinden. |
| Foltan | Spieldesign | Pflichtgespräch: `e2-foltan-haltung` = `kalt` (Vorwurf, „Das passiert mir nicht noch mal“) oder `offen` (Foltan erklärt, kann sich schlecht entschuldigen; Lia: „Verziehen hab ich dir noch nicht“). Kein vollständiger Vertrauensabschluss. Kyra trifft Foltan („Ich überleg noch, ob ich dich beiße“). |
| Bericht vor der Prüfung | Quellenprüfung §8 | Flick berichtet, Kyra platzt dazwischen; Lia erinnert sich nur an die Axt. |
| Prüfung | Neutral (§1) | „die Prüfung“, „der Druide“; Trank ohne Chemie, Dosis oder Tödlichkeit. Elnon lässt den Ausgang für Nichtzauberer unausgesprochen; der Druide weicht auch nachts aus. |
| Lias Entscheidung | Spieldesign | Drei Begründungen, alle münden in „Weil ich es wissen will“ (`e2-pruefung-wahl`). Danach `storyAction('lift')` und `G.ui.hold(…, { struggle: true })`, das nur Zeit kostet. Hinweis: Die eingebaute Anleitung der Aktion `lift` spricht noch von der Wiege (UI-Text, nicht Szenentext). |
| Strick zerrissen | Adaption | Beim Ausbruch wirft jemand Lia einen Strick um die Handgelenke, der reißt (Film: „Fesseln gesprengt“ im Nachbericht). Zwei Rebellen halten sie (Tafel `e2-pruefung`). |
| Sehkugel | Zwischenspiel | Gerahmt „Weit entfernt …“, Sprecher `vamir` (Der Meister). Er bemerkt das Licht und lässt Baris holen. Regeln der Kugel werden nicht erklärt. Lia erfährt davon nichts; der Druide äußert nachts nur die Sorge, man sehe so ein Licht weit. |
| Ignatius als Name | Wissen | Der Druide nennt Ignatius von Ignis als Einzigen, der helfen könnte, seit Dunkelhain verschwunden. Nicht „einziger Überlebender der Zehn“ (Valentus' Verbleib bleibt offen). |
| Erschöpfung | Spieldesign | In `e2-flicks-herkunft` läuft Lia langsamer (Geh- und Renntempo gesenkt, nur auf dieser Karte). |
| Flick finden | Spieldesign | Ihre Fußspuren führen im Spurenblick vom Feuer zum Wachturm im Nordwesten. |
| Flicks Herkunft | Wortlaut neu | Halb Elfe, halb Mensch („für die einen zu spitz, für die anderen zu rund“); beim Eid nur die Hälfte erzählt; Ablehnung in Trapas und bei den Elfen. Eltern bleiben unbenannt. Lias Bestätigung in drei Tonlagen (`e2-flick-ton`), keine Zahlenstrafe für Misstrauen. |
| Nachtgespräche | Spieldesign | Azar (Erinnerung `e2-mem-nachtsuppe`), Foltans zweite Chance je nach Haltung (`e2-foltan-nacht` = `angehoert`/`abgewiesen` bzw. `dank`/`spitz`), Druide (neutral), Alastir. Alle optional. |
| Begleiter | Technik | `G.state.party` bleibt `['flick', 'kyra']`. In Eber, Prüfung und Nachtlager stehen Kyra und Flick als Figuren in der Szene (Sitzplätze, Tresen, Turm). Im Eber folgt Kyra nach dem Auftakt als Begleiterin, im Wald und im Taglager folgen beide. |

## Gruppe Überfall und Lehrerlager: e2-lagerangriff, e2-der-fremde, Geometrie `ignatius-lager.ts`

| Element | Art | Festlegung |
| --- | --- | --- |
| Szenentitel `e2-lagerangriff` | Neutral (§4) | „Überfall im Morgengrauen“ statt des Platzhalters „Feuer im Lager“: Das Lager brennt nicht. |
| Aufbau in drei Teilen | Technik | Alarm (Welt `e2-lager-alarm`) → Kampf → Bach (`e2-bach-flucht`, `e2-bach-lauf`). Jeder Teil ist ein Speicherpunkt über `G.goto('e2-lagerangriff', { part })`; ein Neuladen beginnt den aktuellen Teil neu. |
| Alarm (F2 10:58–11:02) | Adaption | Vor Tagesanbruch, Fackeln, Kampf nur am Tor (Posen, Ton, Kamera). Elnon und zwei Torwachen laufen zum Tor. Flick schickt die Schwestern zum hinteren Bachdurchlass und nimmt Bogen und Messer (Quellenprüfung §4: wahrscheinlich Flick, Wortlaut neu). |
| Azars Säbel, Foltans Weg | Spieldesign | Optional im Alarm: Lia findet Azars Säbel auf der Werkbank (`e2-alarm-azar`: Azar kämpft im Gefecht mit Schwerthieb statt nur zu schubsen). Lia sagt Foltan, wohin sie fliehen (`e2-alarm-foltan` = `weg`: Foltan deckt im Gefecht den Pfad zum Bach) oder bittet ihn mitzukommen (`abschied`: er bleibt am Tor; seine Schuld wegen des Schweigens wird konkret). |
| Flicks Auftrag | Spieldesign | Drei Antworten Lias (`e2-alarm-flick`: mitkommen / nicht allein lassen / sich selbst ausliefern), alle führen dazu, dass Flick bleibt. Kein Versprechen, dass sie nachkommt. |
| Taktikkampf `e2-ueberfall` | Spieldesign | 12×12-Lagerkarte bei Nacht: Zelte, Kisten, Feuerring, Bach im Westen. Sieg: Lia erreicht den Bachdurchlass (`reach`, `unit: 'lia'`). Niederlage nur, wenn Lia fällt; „Erneut versuchen“. Lia mit halben LP (`characterStats('lia', 0.5)`), ohne Urmacht, mit Ausweichen, Ablenken, Stein werfen, Versorgen, Dolch (falls vorhanden), Lichtstoß (falls bekannt). Kyra spielbar (Schubsen, Ausweichen, Stein). Flick, Elnon, Foltan, Azar als KI-Verbündete (`ally`, `guard`, `nonLethal`). Wellen: Runde 2 über den Zaun am Holzstapel, Runde 3 Armbrust am Bach, Runde 4 der vernarbte Baris (`baris-scarred`, `nonLethal`) durchs Tor; ab Runde 6 sucht er Lia. Alle Gegner `nonLethal`. Fortschritt: höchstens 30 EXP / 8 AP für Lia und Kyra, Verbündete 0. |
| Elnons Kampfwerte | Spieldesign | Lokal im Kampf (Level 9, Axthieb, Deckung geben), weil `BATTLE_CHARACTERS` keinen Eintrag hat. |
| Kyras Knöchel | Spieldesign | Geht Kyra im Gefecht zu Boden (`e2-kyra-gestuerzt`), knickt der Knöchel „schon am Zaun“; sonst stolpert sie im Wald über eine Wurzel. Film (11:19): Kyra ist vornübergebeugt, kein Grund genannt. |
| Kyra bleibt zurück (F2 11:19–11:31) | Adaption | Am Bach aus Kapitel IV (Lias Waschplatz). Lia will bleiben (`e2-flucht-wahl`: bleiben / tragen / Hilfe holen); Kyra besteht darauf und lenkt die Verfolger ab („Mich haben sie schon mal verwechselt“). Danach kurzes Schleichen: Lia duckt sich im Farn und erreicht die Steine am Bach, während zwei Laternenträger suchen und Kyra ruft. Entdeckt werden setzt nur zurück. |
| Gefangennahme | Wissen | Lia hört nur Rufe und Stille, sie sieht nichts. Was im Lager geschieht, zeigt eine gerahmte Tafel („Unterdessen, im Lager der Bruderschaft …“): Flick und Elnon gefesselt, ein junger Rebell daneben (Film: mindestens ein weiterer Gefangener), Kyra wird hereingebracht und hat gebissen, Baris: zweimal dieselbe, zweimal die Falsche (eigene Worte), er erkennt Flick von der Eiche über den Feldern. Keine reglose Person, kein Tod. |
| Lias Zusammenbruch | Adaption | Am Bach, im Dunkeln: Schritte, eine warme Hand, Rauch und Minze, Schwarz (Spiegel zu Valentus’ Zusammenbruch; keine Magie). |
| Tafel `e2-trennung` | Offen | Die gelieferte Tafel zeigt ein brennendes Lager. Das widerspricht Quellenprüfung §4; neu erzeugen ohne Feuer (Fackeln, Morgengrauen). Der Text nennt kein Feuer. |
| Lehrerlager (`ignatius-lager.ts`) | Technik | Geometrie der Lichtung für alle Szenen dort: benannte Punkte (Feuer, Sitzplätze, Unterstand mit Lager, Laterne, Eimer, Holzstapel, Hackklotz, Bach, Trittsteine, Übungsplatz mit fünf Stümpfen, Zielscheiben, Pfad Süd, Pfad Ost), Spawns, Ausgangsstreifen, Licht-Helfer. Vitest prüft, dass jeder Standpunkt begehbar ist. |
| Erwachen (F2 12:25) | Spieldesign | Gerahmt mit Geräuschen, dann `storyAction('open-eyes')`. Keine Heilmagie; der Fremde trug sie her. |
| Taumelnder Gang | Spieldesign | Langsames, ungleichmäßiges Gehen mit leichtem Schwanken und kurzen Stolperern (bei „Reduzierter Bewegung“ ohne Kippen). Am Pfad nach Süden oder an den Trittsteinen knicken die Knie ein: beim ersten Mal steht Lia wieder auf, beim zweiten Mal hilft ihr der Fremde ans Feuer. Lia kann sich auch freiwillig zu ihm setzen (`e2-fremder-freiwillig`). |
| Becher | Adaption | Weidenrindentee mit Minze und Honig, ausdrücklich kein Zauber (`storyAction('lift')`). Film 12:50: „nimm das“, Inhalt unbekannt. |
| Fragen | Wortlaut neu | Pflicht: wem das Feuer gehört (er weicht aus), wo Kyra und Flick sind (er weiß es nicht, „später“), warum er hilft (es reiche weit über den Wald hinaus; Lichter sehe man weit). Optional: wie sie herkam, die Bücher im Unterstand (`e2-fremder-buecher`). Lia erzählt nur, was sie selbst erlebt hat. |
| Bernsteingeste | Adaption | Kleines warmes Licht an seiner Hand, Funken, Lia sinkt in Schlaf (F2 13:32 belegt nur das Einschlafen). Kein Bann, keine Heilung. |
| Optionale Blicke im Lehrerlager | Spieldesign | Bücher im Unterstand (Lia kann die Buchstaben noch nicht stillhalten), Eimer, Holzstapel. Flags für spätere Szenen: `e2-fremder-buecher`, `e2-fremder-fragen`. |

## Gruppe Gewölbe: e2-gefangene, e2-flicks-verhoer, e2-flicks-erinnerungen, e2-kyras-widerstand, Geometrie `gewoelbe.ts`

| Element | Art | Festlegung |
| --- | --- | --- |
| Gewölbe (`gewoelbe.ts`) | Technik | Geometrie für `e2-halle` (Boden, Podest mit ausgespartem Hochstuhl, Tisch, Verhörstuhl, Bodenring, Becken, Bogen der Südtreppe, Seitentür) und `e2-kerker` (Gang, drei Zellen mit eigenem Strohboden und Türöffnung, Wachtisch, Kisten, Treppe hinauf, Gang nach Süden). Gitterstäbe sind schmale Verdecker-Streifen: Figuren in einer Zelle stehen hinter dem Eisen und bleiben zwischen den Stäben sichtbar. `kerkerBase({ corridor, cells, open })` setzt Gang, Zellen und offene Türen zusammen. `chainArea()` (Kettenradius um den Ring), `pinArea()` und `pinPlayer()` (Gefangene auf Stuhl/Tisch: Pose, Blickrichtung, kein Laufen, Interaktion bleibt möglich). Vitest prüft alle Standpunkte. |
| Rahmung | Perspektive | Jede Szene beginnt mit `interlude('Unterdessen, …')`; Spielfigur Flick (`e2-flick-gefangen`) bzw. Kyra (`kyra-bound`), keine Begleiter, `G.state.party` unverändert. Lia erfährt nichts davon. |
| Beobachten an der Kette (`e2-gefangene`, F2 13:43) | Spieldesign | Vor dem Auftritt sieht sich Flick in Reichweite der Kette um: der lose Ring im Boden (nur, solange der Wärter mit dem Schlüssel weiter weg ist), der Schlüsselbund am Gürtel des patrouillierenden Wärters (nur, wenn er vorbeikommt), Elnon (geflüstert: kein Wort über Lia; Flick spottet über ihren halben Eid, Elnon: „Diesmal ist das gut so.“), die Seitentür zu den Zellen. Alle vier sind Pflicht; `e2-flick-sah-ring` am Szenenende. |
| Auftritt (`e2-gefangene`) | Inszenierung | Der Meister tritt auf dem Podest aus Rauch (wie im Finale von Buch 1), Baris kommt die Südtreppe herauf und kniet. Tadel, „drei Würmer“ statt Köder als Bild, Baris an die Wand. Elnon provoziert mit Ebaril (seine Herkunft aus dem Roman), ein Wärter schlägt zu (nur Ton, Kameraruck). Flick verteidigt ihn (`e2-gef-ton` = `kapuze`/`klotz`/`lauter`), Elnon wird zur Seitentür geführt. Baris meldet die Flucht der meisten Rebellen nach Süden. Der Besitzanspruch bleibt Behauptung des Meisters („war schon meins, bevor es sie gab“). |
| Nagel (`e2-flicks-verhoer`, F2 19:07) | Adaption | Zwei Fenster, in denen keiner hinsieht: ein Bote ruft Baris an den Bogen und der Meister steigt zum Hochstuhl; später schickt er Baris zum Tisch nach einem Kästchen. Versuche unter Beobachtung bringen nur Baris’ Blick und einen Neuversuch. Erstes Fenster: wackeln; zweites: `storyAction('reach')`, der Nagel verschwindet im Ärmelsaum. `e2-flick-nagel` am Szenenende. |
| Drohungen und Finger | Neutral | Die Ohren-Drohung bleibt Drohung. Bei den Fingern schwenkt die Kamera aufs Becken, das Licht sinkt, Kette, Abblende, ein dumpfer Ton. Erzähler nennt keine Verletzung, nur: Flick nannte keinen Ort, ihre Faust (mit dem Nagel) blieb zu. |
| Erinnerung (`e2-flicks-erinnerungen`, F2 22:05) | Neutral (§2) | Tafel `e2-erinnerung` mit Unterschrift „Was der Meister in Flicks Erinnerung zu sehen behauptet“; alle Bildinhalte sind seine Worte (Stadt, Reihe von Gefangenen, einer seiner Leute, eine Frau). Die Frau bleibt namenlos und ohne Verwandtschaft; ihr Schicksal wird nicht ausgesprochen, Flick schlägt die Erinnerung vorher zu. |
| Innerer Widerstand | Spieldesign | Erst eine Wahl, womit Flick ihren Kopf füllt (`e2-erinnerung-gedanke` = `wald`/`witze`/`steine`), dann `stealthGame('cover', 'Die Erinnerung verschließen')`: Flick versteckt ihr Bild der „Leseratte“ im Wald ihrer Erinnerung vor seinem suchenden Blick (die Wache der Challenge). Fehler wiederholen nur den Abschnitt, keine Belohnung. Danach verlangt der Meister die Schwester („ob sie auch so viel Wald im Kopf hat“). |
| Kyra auf dem Tisch (`e2-kyras-widerstand`, F2 24:14) | Spieldesign | Zwei Weigerungsrunden in Kyras Ton (`e2-kyra-antwort` = `ahnung`/`biss`/`plan`). Dazwischen dreht der Meister ihr den Rücken zu, Kyra zupft am Knoten (`storyAction('tend')`), ein Wärter bemerkt es, der Strick wird fester gezogen, Kyra beißt nach ihm. Die Gefangenschaft bleibt. |
| Schutz um Lia | Neutral | Der Meister sagt nur, wo sie sein müsste, liege „Nebel“, „wie eine Hand über einer Kerze“; wer oder was, bleibt offen. Kyras Triumph steht nur in ihren Gedanken („Diesmal bin ich gern die Falsche“). Abblende in Violett, bevor seine Hand sie berührt. |
| Gesten-Bilder | Technik | Die eingebauten Bilder der Story-Aktionen zeigen Buch-1-Momente (Valentus’ Hand im türkisen Licht, Lias Ferse). `gewoelbe-geste.ts` legt für Nagel und Knoten eine eigene Nahaufnahme aus Hallenhintergrund und echten Figuren darüber und ersetzt die Anleitung; Eingabe und Fortschritt bleiben bei der UI. Beim Versteckspiel wird nur die Anleitung ersetzt. |
| Kein Belohnungsspiel | Regel | Keine dieser Mechaniken gibt Gegenstände, EXP oder Wissen. Gesetzt werden nur Szenen- und Ergebnisflags. |

## Gruppe Kerker und Kontrolle: e2-zellengespraeche, e2-flick-entkommt, e2-kontrolle

| Element | Art | Festlegung |
| --- | --- | --- |
| Zellen (`e2-zellengespraeche`, `e2-flick-entkommt`) | Technik | Geometrie aus `gewoelbe.ts` (`kerkerBase`). Flick in der westlichen Zelle, Elnon und später Kyra in der mittleren, die östliche steht leer. Elnon und die Wärter werden zur Laufzeit gesetzt (sie stehen außerhalb von Flicks begehbarer Zelle). Für die Gespräche durch die Wand fährt die Kamera nah an beide Zellen, weil die Figuren hinter Gitter und Riegel klein wirken. |
| Elnon wird geschlagen (F2 30:17) | Inszenierung | Nur über Schwarzbild, Ton (Schläge, Kette) und Wortwechsel; danach Blende auf die Wärter, die die Zelle verlassen. Elnons Spott ist neu formuliert (kein Filmwortlaut), die Wärter antworten mit „Der Meister will morgen noch was von ihm, das reden kann“. |
| Wärterroutine (Herzstück) | Spieldesign | Drei Pflichtbeobachtungen durchs Gitter (`zellengespraeche-routine.ts`, Vitest): Der Wärter mit dem Bund geht die Zellen ab und trägt ihn links am Gürtel (nur sichtbar, wenn er an Flicks Gitter vorbeikommt); steht er an der Treppe, döst der am Tisch; klopft es oben, gehen beide zusammen hinauf (jede zweite Runde). Daraus folgt Flicks Plan: Wer sie holt, kommt zu zweit, der mit dem Bund vorn. |
| Handschelle mit dem Nagel | Adaption | Nur wenn keiner hinsieht (Phasen „Treppe“ und „zu zweit“), sonst nur ein Gedanke und Neuversuch. `storyAction('tend')` mit eigener Nahaufnahme (`restageGesture`, Kerkerhintergrund). Danach Wahl, wie die Schelle zu aussehen soll: Zudrücken würde sie wieder verschließen (wird verworfen, kein Nachteil), Stroh im Spalt oder Ärmel darüber (`e2-zelle-schelle` = `stroh`/`aermel`, in `e2-flick-entkommt` aufgegriffen). Film: zeigt keine Technik (Quellenprüfung §6). |
| Versöhnung (F2 31:27) | Wortlaut neu | Elnon entschuldigt sich konkret: Er hat sie vor allen Lügnerin genannt und dabei mehr über ihre Ohren als über die Lüge geredet. Flick wählt, wie viel sie erklärt (`e2-zelle-ehrlich` = `wenig`/`angst`/`ganz`); Abmachung: nach der Flucht ein neuer, ganzer Eid. Keine Romanze, kein körperlicher Trost. |
| Kyra halluziniert (F2 31:50) | Neutral | Was Kyra sieht, steht nur in ihren eigenen Zeilen (lila Licht, eine Stimme in der Wand, die Mutter und die Hühner); Elnon deutet nur („Er war lange in ihrem Kopf“). Flick erreicht sie durch die Wand (`e2-zelle-kyra` = `kornfeld`/`summen`/`beissen`), Kyra schläft ein. |
| Visionen und Zeitgewinn (`e2-flick-entkommt`, F2 33:44) | Wortlaut neu | Keiner der drei weiß, wo Lia ist; „was nicht drin ist, kann er nicht rausholen“; jede Nacht im Kerker ist eine Nacht für Lia. Flick tröstet Kyra mit einer Wahl (`e2-flucht-trost`). |
| Handgemenge (F2 34:43, §6) | Adaption | Zwei Wärter holen Flick (Bund vorn, Knüppel hinten an ihrer Kette). Reaktionsmoment `flick-entkommt-moment.ts` (Ring schließt sich, E/Leertaste/Klick im goldenen Fenster; Vitest): „Losreißen!“ (Hand aus der gelockerten Schelle, Ellbogen nach hinten), „Zuschlagen!“ (die offene Schelle an der Kette). Ein Fehlversuch wiederholt nur diesen Takt. Der Wärter mit dem Bund geht benommen zu Boden, der Bund liegt auf den Steinen; der andere flieht schreiend zur Halle (Alarm). Kein Zauber, keine Verletzung im Bild. |
| Elnon bleibt (F2 35:04) | Entscheidung Elnons | Flick schließt die Zelle mit dem blanken Schlüssel auf; Elnon bleibt bei Kyra, die keine zehn Stufen weit käme, und schickt Flick nach Hilfe. Drei Antworten Flicks (`e2-flucht-abschied`), alle führen zu seinem Bleiben. Flick schließt auf seinen Wunsch wieder ab und lässt ihre Schellen im Gang liegen (passt zur Tafel `e2-flucht`). |
| Schleichweg | Spieldesign | Eigene Karte `e2-kerker-alarm`, eigener Speicherpunkt (`G.goto('e2-flick-entkommt', { part: 'alarm' })`). Flick versteckt sich zuerst in ihrer eigenen offenen Zelle; der alarmierte Wärter sucht mit Laterne die Zellenfronten ab (Rundgang), ein Posten mit Spieß wechselt an der Treppe zwischen Lauschen nach oben und Blick in den Gang. Verstecke: dunkle eigene Zelle, leere Ostzelle, Nische an den Kisten; die beiden letzten setzen Checkpoints. Entdeckt = sanfter Rücksprung, nie Game Over. Ausgang: Treppe im Nordosten. Geometrie in `flick-entkommt-weg.ts` (Vitest). |
| Flicks Weg nach draußen | Neutral | Erzählerkarte: Als die Wärter die leeren Schellen fanden, war Flick schon zwischen den Bäumen. Wohin sie geht, bleibt offen (Anschluss an das Versteck-Zwischenspiel in `e2-aufbruch`). |
| Vamirs Wut (`e2-kontrolle`, F2 35:35) | Adaption | Vamir findet den fehlenden Nagel in seinem eigenen Verhörstuhl (Rückgriff auf `e2-flicks-verhoer`). Statt einer Tötungsdrohung bestraft er die Wärter mit Spott: Sie bewachen ab jetzt die leere Zelle. Baris wird für die frühere Flucht des Mädchens mit dem Licht getadelt („Ich zähle mit“). |
| „Schwächster Geist“ | Wortlaut neu | Vamir: lieber dort anklopfen, „wo die Tür schon wackelt“; Elnon bietet seinen eigenen Kopf an und nennt es Feigheit, Vamir nennt es Sparsamkeit. Kyra wird gebracht, nicht „vorgeführt“; kein „Monster“-Spott des Films. |
| Elnon erreicht Kyra nicht (Herzstück) | Spieldesign | Elnon kniet an der Kette (`pinPlayer`). Drei Versuche über Kyra (Name, Lia, der Hof) und optional die Kette selbst (der Ring wackelt, hält; Baris stellt den Stiefel darauf). Jeder Versuch prallt ab: Kyra antwortet mit fremder Ruhe, beim Namen Lia flackert das violette Licht kurz aus und kehrt stärker zurück. Kein Rettungszweig, keine Belohnung. Flag nur `e2-kontrolle-letztes` (letzte Worte). |
| Kontrolle sichtbar machen | Inszenierung | Violettes Licht an Kyras Kopf, Vamir in Pose `cast`, Herzschlag, Zoom. Ihre Stricke werden durchgeschnitten, sie reibt sich nicht einmal die Handgelenke. Ab dann spricht sie als `e2-kyra-gebannt` und nennt Vamir „Meister“. Ihre Figur wechselt erst mit der Klinge zu `e2-kyra-gebannt` (das Laufblatt trägt das Kurzschwert). |
| Schwert und Stoß (F2 37:16–37:56, Quellenprüfung §3) | Inszenierung | Ein Wärter gibt ihr seine Klinge (Film: Vamir lässt sich das Schwert einer Wache geben). Tafel `e2-kontrolle`, darüber Vamirs Befehl in eigenen Worten und Elnons letzte Worte als Wahl. Der Stoß: Ausholen, violetter Blitz, Schnitt ins Schwarz, dumpfer Ton, Kette, Fall-Geräusch; Karte „Ein Stoß im Dunkeln. Ketten auf Stein. Elnon fällt.“ Danach zeigt die Kamera nur Vamir und Kyra; Elnon bleibt außerhalb des Bildes. |
| Elnons Schicksal | Neutral (§3) | Niemand sagt, dass er tot ist. Vamir: „Schafft ihn mir aus den Augen.“ Kein Körper im Bild, keine Wunde, kein Blut. |
| Neues Lieblingsspielzeug (F2 38:04) | Wortlaut neu | „Alte Spielsachen gehen kaputt, Baris. Diese hier nicht. Ich glaube, die behalte ich. Sie ist mir schon jetzt die liebste.“ Kyra: „Wie Ihr befehlt, Meister.“ (statt der Filmzeile über Pflicht). |

## Gruppe Urmacht und Atem: e2-urmacht, e2-konzentration

| Element | Art | Festlegung |
| --- | --- | --- |
| Erwachen (`e2-urmacht`, F2 16:19) | Wortlaut neu | Lia wirft dem Fremden die Schlafgeste vor („wie Vater die Hühner“); er hat sie einen Tag und eine Nacht schlafen lassen. Eigene Karte `e2-urmacht-lager` (Tag). Optional: Rindenzeichnungen (`e2-urmacht-rinde`, er nimmt im Gespräch darauf Bezug), Bücher (die Buchstaben halten wieder still; das verschnürte Buch bleibt zu), Eimer. Die Wege sind gesperrt („Erst will ich Antworten“). |
| Fragebaum | Spieldesign | Pflicht: „Wo sind Kyra und Flick?“, „Was ist dieses Licht?“, danach „Was hat das alles mit mir zu tun?“. Optional: „Wer seid Ihr?“ (weicht aus, `e2-urmacht-wer`), die Schlafgeste („ein Kniff“, verspricht, künftig zu fragen; `e2-urmacht-schlaf`). Gestellte Fragen in `e2-urmacht-fragen`. |
| Freunde gefangen (F2 16:31) | Adaption | Film: Ignatius bestätigt die Gefangennahme. Spiel: Er war nachts am Lager und trennt ausdrücklich „gesehen“ (Zelte, kalte Asche, keine Gräber, Stiefel und gestemmte Füße am Bach) von „geglaubt“ (lebend mitgenommen). Zu Foltan und Azar sagt er nur, nicht alle Spuren führten in Gefangenschaft. Lias Reaktion `e2-urmacht-freunde` = `holen`/`andere`/`still`. |
| Xenovia-Geschichte (F2 16:47) | Spieldesign | Film: Ignatius erzählt, Lia kennt sie schon. Spiel: Lia erzählt selbst weiter (`urmacht-wissen.ts`, Vitest): Meeresgrund, Verbannungsfest, Kettengebäck. Tags bei Buch-1-Wissen: `lore-xenovia`/`k2-lore-xenovia`/`k3-lore-verbannungsfest`, Fest-Erinnerungen `k1/k2/k3-mem-fest`, Kettengebäck in der Tasche. Falsche Antworten (Crios als Stern: Anspielung auf den Gaukler aus Kapitel II, Honig-Apfelkuchen usw.) werden freundlich korrigiert und die Frage ohne sie erneut gestellt; keine Strafe. Treffer beim ersten Versuch: `e2-urmacht-vorwissen` (0–3), danach ein passendes Urteil. Mit Alana-Buch/-Wissen erkennt Lia den Rat der Zehn aus ihrem Buch. |
| Tafeln | Inszenierung | `e2-bericht-xenovia` und `e2-bericht-wiege` erscheinen, während er erzählt, mit der Unterschrift „Nach der Erzählung des Fremden“ (seine Zeichnungen, keine Erzählerfakten). |
| Kettengebäck teilen | Neue Verbindung | Nur wenn Lia noch Kettengebäck aus Buch 1 trägt: teilen (Gegenstand weg, Erinnerung `e2-mem-kettengebaeck`) oder für Kyra aufheben (`e2-urmacht-gebaeck` = `geteilt`/`kyra`). |
| Valentus (F2 17:14–17:49) | Neutral | „Schwer verwundet“ statt „tödlich“; sein Verbleib bleibt offen („Niemand hat ihn danach gesehen“). Die Wiege mit zwei Säuglingen ist seine Zeichnung; Lia zieht den Schluss selbst (`e2-urmacht-erkenntnis` = `sofort`/`zweifel`/`still`). Warum Lia und nicht Kyra: „Das weiß nur Valentus“ (Wissen vs. Vermutung). Woher er das alles weiß, verschweigt er noch. |
| Schuld und Hergeben (F2 17:52–18:26) | Spieldesign | Lia zählt Hof, Eltern, Kyra an der Kette und die Gefangenen auf, ohne Gewaltdetails. Drei Wege, die Macht loszuwerden (`e2-urmacht-hergeben` = `ausliefern`/`abgeben`/`einsperren`), jeder mit eigener Gegenrede (Erpresser lässt niemanden laufen; man legt sie nicht ab wie einen Mantel; ein Schloss ohne Wächter ist eine Einladung). Lia nennt den Meister nicht (sie kennt ihn nicht), sondern „sie“. |
| Angebot zu lehren | Wortlaut neu | „Halten statt gehalten werden“; Lias Antwort `e2-urmacht-antwort` = `sofort`/`freunde`/`zweifel` wird in `e2-konzentration` aufgegriffen. |
| Zweifel vor der Übung (F2 20:50) | Wortlaut neu | Lias Angst um die Freunde ist ausdrücklich Angst („vielleicht tut ihnen gerade jemand weh“), kein Wissen aus den Gefangenenszenen. Bild des Fremden: ein Huhn halten, ohne es zu zerdrücken. Ton `e2-konz-ton` = `bereit`/`angst`/`trotz`. Die Filmzeilen über Hülle und Inhalt und „Zweifel sind Feinde“ werden nicht übernommen. |
| Minispiel „Sammlung“ | Spieldesign | DOM-Paneel `konzentration-game.ts`, Regeln rein in `konzentration-logic.ts` (Vitest, deterministisch): Licht in der Mitte (türkis, Urmacht), Atemring (gold), vier Gedanken („Kyra“, „Flick“, „der Hof“, „Foltan“) treiben in fester Reihenfolge vorbei und ziehen das Licht an. Steuern mit Pfeilen/WASD, Ziehen mit Maus/Finger oder Bildschirmpfeilen (Touch); ausatmen mit E/Leertaste/Enter, Klick/Tipp oder Knopf, wenn der Ring voll ist. Anklicken eines Gedankens = „festhalten“: er zieht kurz viel stärker (Fehler, den die Übung lehrt). Drei ruhige Atemzüge = Impuls. Fehler kosten nur Zeit (zu früh, unruhig, verpasst: nur dieser Atemzug; entgleitet das Licht: neuer Atemzug, gezählte bleiben). Nach Ausrutschern wird der Zug sanfter, der Fremde flüstert einen Rat. „Reduzierte Bewegung“: langsamere Gedanken, längeres Fenster, Atem als sich füllender Bogen statt pulsierendem Ring, kein Pulsieren. |
| Erster bewusster Impuls | Inszenierung | Lia richtet die Hand auf einen Übungsstumpf: kleines türkises Licht, Funken, Laub. Kein neuer Zauber; es ist Lichtstoß. |
| Lichtstoß | Vertrag | Ohne Lichtstoß: einmal `learn('lichtstoss')` mit Fähigkeitstoast (`grantOnce('e2-konz-lichtstoss')`). Mit Lichtstoß (Weiterreise, `knewLichtstossBefore()`): Der Fremde nennt den früheren Impuls einen Instinkt, die Übung Kontrolle (`e2-konz-kontrolle`); nichts wird verlernt. Direkteinstieg nimmt den Weg ohne Lichtstoß; Testweg für den anderen siehe Kopfkommentar in `konzentration.ts`. |
| Rückmeldung nach der Übung | Spieldesign | Hat Lia einen Gedanken festgehalten, nennt der Fremde ihn („Das ist Liebe. Nur gerade zur falschen Zeit“); fehlerfrei: „Talent“; sonst: das Licht kommt zurück, wenn man es ruft. Fehlerzahl `e2-konz-versuche`. Keine Belohnung außer Lichtstoß. |

## Gruppe Ignatius, Stab und Aufbruch: e2-ignatius, e2-stabtraining, e2-aufbruch

| Element | Art | Festlegung |
| --- | --- | --- |
| Aufbau `e2-ignatius` | Technik | Drei Speicherpunkte über `G.goto('e2-ignatius', { part })`: Nacht (Traum, Name, Fragen; Karte `e2-ignatius-nacht`), `morgen` (Stab; `e2-ignatius-morgen`), `nachtweg` (Spurensuche; `e2-ignatius-nachtweg`). Ein Neuladen beginnt den aktuellen Teil neu. |
| Albtraum (F2 25:19–26:00) | Neutral / Wissen | Eigenes DOM-Bild `ignatius-traum.ts`: violetter Dunst, Überschrift „Ein Traum“, jede Stimme als „Kyra, im Traum“ bzw. „Flick, im Traum“ beschriftet. Inhalt sind Lias Ängste (Kyra ruft, es sei „alles lila“; Flick schickt sie fort; „es tut nicht weh“), keine Gefangenenfakten. Kein Blut, keine Qualen im Bild (Film: „überall Blut“). Danach `storyAction('open-eyes')` mit eigener Anleitung. |
| Vorstellung | Wortlaut neu | Auslöser ist Lias Wahl (`e2-ig-auftakt` = `frage`/`trotz`/`schweigen`), nicht der Filmvorwurf „Ihr wisst alles über mich“. Ab dem Namen `e2-ignatius-vorgestellt`; Lia hält ihm vor, dass er in `e2-urmacht` vom Rat erzählt hat, als wären es Fremde (Spiel-Kontinuität: Lia kennt den Rat seit `e2-urmacht`). |
| Fragebaum | Spieldesign | Pflicht: Rat (Gesetze, Ignis, Wächteramt), Dunkelhain (vier Abtrünnige; Valentus und er als einzige Treue nach seinem Wissen; Gwynn), Rückzug und Spüren, der Meister (Vamir, „der Allmächtige“), der Traum. Optional: Azar aus Ignis (Buch-1-Verbindung, DESIGN §3). Gestellte Fragen in `e2-ig-fragen`. Wissen `e2-lore-rat`, `e2-lore-vamir`. |
| Gwynn (F2 27:16) | Neutral (§5) | Nur Bericht und Glaube: „Ich glaube, dass sie lebt, irgendwo gefangen. Glauben, nicht wissen.“ Höhle und Feuer aus dem Film werden nicht geschildert. |
| Sechzehn Jahre | Kanon | Statt „14 Jahre“ (F2 27:33). Neu: Er erwähnt „vor ein paar Tagen ein Flackern, zu kurz, um ihm zu folgen“ (Buch-1-Finale an der Eiche, etwa eine Woche vor der Prüfung), erst die Prüfung „klang wie eine Glocke“. So bleibt Buch 1 stimmig, ohne dem Film zu widersprechen. |
| Vamirs Name | Neutral | Früherer Name fällt nicht. „Ein großer Name für einen, der im Schatten wohnt“ statt der Filmpointe. Er besitzt die Urmacht nicht, braucht die Trägerin. |
| Traum ungewiss | Wissen | Ignatius: Erinnerung, Angst oder Wunsch; „manche setzen sich gern in fremde Träume. Vamir gehört dazu“ – als Möglichkeit, ausdrücklich „als Frage, nicht als Antwort“. Kein Erzählerfakt. |
| Schattentöter (F2 28:47) | Inszenierung | Tafel `e2-schattentoeter`, `storyAction('reach', 'Den Stab nehmen')` mit eigener Nahaufnahme (Lehrerlager, `restageGesture` aus `gewoelbe-geste.ts`), `grantOnce('e2-staff-received')`. Der Stab ist ausdrücklich geliehen („Mit dir dran“), macht nicht stärker, gibt dem Licht „eine Richtung“. Danach `liaLook()` = `e2-lia-stab`. |
| Nachtweg (F2 29:31–29:58) | Spieldesign | Spurenblick: Fußspuren vom leeren Platz, verlorener Holzscheit, geknickte Zweige am Ufer; Lias eigene alte Spuren nach Süden als falsche Fährte (Rückgriff auf `e2-der-fremde`). Optional seine Laterne (wandert als Licht mit). Erst nach allen drei Spuren hört Lia ihn hinter den Trittsteinen. Er sammelt Holz; Alltagshumor neu („Zauberei wärmt keine Füße. Dafür nimmt man Buchenholz“), kein Filmwortlaut („Unentschieden“ entfällt). Lia trägt die Hälfte (`e2-feuerholz`, nur in dieser Szene) und legt nach. Ton `e2-ig-nachtweg-ton`. |
| Zielübung `e2-stabtraining` | Spieldesign | Ignatius ruft vier Ziele mit Beschreibung (`stabtraining-ziele.ts`, Vitest), Lia zielt mit einer eigenen Zielleiste (`stabtraining-zielen.ts`: Pfeile/WASD/Bildschirmpfeile führen einen goldenen Ring von gemaltem Objekt zu Objekt, E feuert, Esc setzt ab). Direkt neben den Zielen: Vogelnest, seine Laterne, sein Eimer (Requisiten, vergrößert). Fehltreffer und falsche Ziele: nur Kommentar, Zählung `e2-stab-fehler` für sein Urteil. |
| Wasserkrug | Abweichung | Es gibt kein Krug-Requisit; das Spiel nimmt seinen Wassereimer (`bucket`). |
| Übungskampf `e2-uebungskampf` | Spieldesign | 8×8 am Bach, zwei Leichenfresser (`ghoul`, lokal Stufe 2, rostiges Beil, `nonLethal`: sie fliehen). Lia mit `e2-stabimpuls` (Einzelziel, 1–3, Kraft 5, 4 MP, Abklingzeit 2, VFX wie Lichtstoß), Lichtstoß falls bekannt, Ausweichen, Ablenken, Versorgen. Ignatius (lokale Werte, nur `decken`) bleibt per KI an Lias Seite (`block`) und gibt ihr vor jedem Gegnerzug Deckung (`guarded`), greift nie an. EXP/AP nur beim ersten Sieg (`e2-uebungskampf-gewonnen`, danach Budgets 0). Niederlage: „Erneut versuchen“. |
| Anlass des Kampfes | Adaption | Film zeigt nur Training. Die Leichenfresser (Buch-1-Kreatur aus dem Regenwald) folgen dem Licht der Übung zum Bach. |
| Bereitschaft (F2 32:20–33:38) | Wortlaut neu | Lias Drängen als Wahl (`e2-stab-ton` = `treffen`/`zeit`/`zweifel`), sein Kern: Kraft ohne Besonnenheit „ein Pferd ohne Zügel“; „Das wächst. Oder es wächst nicht.“ Eigenes Versagen nur angedeutet („Ich war einmal sehr sicher …“). Die Filmsätze über Parcours, „größte Feinde“ und „die Antwort bist du selbst“ entfallen. `learn('e2-stabimpuls')`, `e2-training-complete`. |
| Vamir auf der Anhöhe (F2 38:10–38:20) | Neutral (§7) | Tafel `e2-vamir-anhoehe`, Erzähler: Blitze kalt und violett, „Wem dieses Zeichen galt, sagte er niemandem.“ Kein Zweck. |
| Wache auf der Brüstung (F2 38:22–38:33) | Neutral (§7) | Tafel `e2-stadtwache`, Unterschrift „Viele Hügel weiter, auf einer steinernen Brüstung“, eigener Sprecher `e2-wache-bruestung` („Wache auf der Brüstung“) statt „Stadtwache“; keine Stadt, kein Ort, keine Zugehörigkeit. Zwei trockene Zeilen. |
| Flick im Farn (F2 38:38–39:19) | Spieldesign | Gerahmt „Unterdessen, irgendwo in den Wäldern, noch vor Tagesanbruch …“. Weltszene `e2-flick-versteck` auf dem Nachtwald des Prologs (Geometrie und Verstecke von `prolog-flucht`, Name „Irgendwo im Wald“): Horn (tiefer Signalton, kein eigenes Horn-Geräusch vorhanden), Flick duckt sich in den Farn, vier Verfolger mit Sichtkegeln suchen dicht daneben, 15 Sekunden still bleiben. Gesehen werden setzt nur den Moment zurück. Danach zweites Horn, die Verfolger ziehen ab. Flicks Ziel bleibt offen („Dann such ich sie eben“). Figur `e2-flick-gefangen` (ohne Waffen; die Schellen sind im Sprite kaum zu sehen). |
| Morgengespräch (F2 39:20, Adaption) | Spieldesign | Lia sagt Ignatius, dass sie geht; er hält sie nicht für bereit, bittet um einen halben Mond (Argument `e2-auf-argument`). Danach geht er Wasser holen. Lia packt ihr Bündel und wählt den Abschied: am Bach ins Gesicht (`e2-abschied` = `gesicht`, sein Rat „bis drei zählen“) oder eine Nachricht auf Birkenrinde (`brief`, Text `e2-abschied-brief`; Lia kann schreiben, Kyra könnte es nicht lesen). |
| Herbsthang `e2-herbsthang` | Spieldesign | Neue Karte auf `bg/e2-herbsthang` (Geometrie `aufbruch-hang.ts`, Vitest). Spurenblick: ein alter Stiefelabdruck („Flick? Nein.“), Rehspuren, eine Kerbe im Stein – „nur Wild und alte Wege“. Das weiße Leinen im roten Busch, Rast darunter. |
| Helle Gestalt (F2 40:07) | Neutral (§7) | Während Lia rastet, gleitet dicht hinter ihr etwas Helles mit blau-violettem Rand vorbei (gezeichnete Form + Licht, kein Gesicht, keine Figur, kein Name). Wahl „Umdrehen“ oder „Still sitzen bleiben“ (`e2-hang-reaktion`), beide enden im Umdrehen: nichts ist da. Kein Zauber, keine Erklärung. |
| Schluss | Vertrag | Tafel `e2-aufbruch`, Erzähler: Lia allein; Kyra und Flick irgendwo hinter den Hügeln, Elnons Schicksal offen („was immer aus ihm geworden war“), Lia weiß von alledem nichts; Ziel offen. `e2-finished`, `setParty([])`, Speicherstand `G.state.save('teil-2', 'e2-aufbruch', { book2Finished: true })`, Abspann „Ende des zweiten Buches“ (`aufbruch-credits.ts`, Rolle aus Kapitel V), `finishBook2()`. „Fortsetzen“ danach zeigt nur Tafel + Wahl (Abspann noch einmal / Titel / drittes Buch, sobald vorhanden). |

## Prüfung und Korrekturen

Durchgang nach Zustands-, Kanon-, Spieltest- und Bildschirmprüfung. Jeder Befund wurde zuerst am Code nachgeprüft.

### Behoben: Zustand

| Befund | Korrektur |
| --- | --- |
| Neuladen nach dem Sieg im Übungskampf ließ `e2-stab-bach` bis Teil III offen (Encounter-Speicherstand vor `completeObjective`). | `stabtraining.ts`: Der Zweig „schon gewonnen“ schließt `e2-stab-bach` vor `afterTheFight` (no-op, wenn schon erledigt). |
| Über die Weiterreise blieb `k5-weiterreise` durch ganz Teil II offen; das HUD fiel darauf zurück. | `continueToBook2()` (`bookContract.ts`) schließt beim Übergang jedes noch offene Ziel aus Buch 1 und räumt flüchtige UI ab (wie der Szenenwechsel vom Titel). |
| Die optionale Brillen-Suche (`e2-logge-brille`) blieb offen, wenn Lia die Gläser nicht zurückgab. | `taverne.ts`: Nach dem Abblenden am Ausgang wird das optionale Ziel geschlossen; die Taverne wird nicht wieder besucht. |
| Kyras Sturz aus einem verlorenen Überfall-Versuch wirkte im gewonnenen Versuch nach. | `lagerangriff-battle.ts` setzt nur noch das Kampf-Flag `e2-kyra-gestuerzt`; `startRaid` übernimmt es beim Sieg aus `result.flags` (sonst `false`). |

### Behoben: Spielablauf und Bild

| Befund | Korrektur |
| --- | --- |
| `e2-aufbruch`: Zielmarker [786,690] lag 120 px südlich des Auslösers; am Marker passierte nichts, am Rand kam „Nicht ohne Abschied …“. | Der Auslöser `pfad-sued` deckt jetzt den ganzen Südpfad bis über den Kartenrand ab, der Marker steht darin ([762,560]). Zusätzlich prüft das Skript nach dem Abschied, ob Lia auf dem Pfad steht (Auslöser feuern nicht beim Durchqueren in Zwischensequenzen oder wenn man schon darin steht). `e2-der-fremde`: Marker ebenfalls in den Auslöser verlegt. |
| `e2-gefangene`: Klick auf Elnon vom Kettenrand aus startete das Gespräch nicht (Maus braucht Radius − 2, E den vollen Radius; Abstand 36,6 px bei Radius 38,5). | Elnon kniet 6 px näher am Ring ([464,210]); vom Kettenrand liegt er jetzt sicher innerhalb der Klick-Reichweite. Die Engine-Ungleichheit selbst (`WorldScene.ts`) liegt außerhalb von Teil II, siehe „Offen“. |
| Toasts („Ziel erledigt“, Gegenstand) aus der vorigen Szene oder Perspektive erschienen in der nächsten (u. a. Flicks Farn-Ziel in Lias Morgen, gegen §1). | Neuer Helfer `nextScene()` (`shared.ts`) für alle Szenen- und Teilwechsel in Teil II: räumt nach dem Abblenden flüchtige UI ab (`ui().reset({ keepFade: true })`, wie die Titel-Überleitung), dann `G.goto`. |
| Toasts auf dem Tafelrahmen (05 Sehkugel, 16 Schattentöter). | `e2-pruefung` wird direkt nach der Entscheidung erledigt (nicht erst vor der Meister-Tafel); Schattentöter wird nach dem Schließen der Tafel übergeben. |
| Logges schwarze Katze war auf dem dunklen Boden ein unlesbarer Fleck. | Die Katze schläft jetzt auf dem hellen Tisch der Gäste zwischen Logge und Sebastian (eigenes Requisit über dem Tisch, Streichel-Punkt vor dem Tisch). |
| Übungsplatz: Nest kaum als Nest erkennbar. | Nest größer (2,2×) und es ruckelt ab und zu (Küken), solange die Zielübung läuft. |
| Telefon quer: Das Sammlung-Feld schnitt die HUD-Zielnotiz an. | Bei niedriger Querlage blendet sich die Zielnotiz aus, solange das Feld offen ist (das Feld trägt eigene Anweisungen). |

### Behoben: Kanon und Wortlaut

| Stelle | Vorher (Problem) | Jetzt |
| --- | --- | --- |
| `bruderschaft.ts` Flick | „ohne halbes Gesicht … Das war sie“ (die Verbrennung war Vamir, Lia hat sie nicht gesehen) | „Ohne Axt. Kyra sagt, er ist ihnen auf allen vieren hinterhergekrochen. Das war sie, nicht ich.“ |
| `ignatius.ts` Frage | „Der Mann mit der Kapuze?“ (nur der Spieler kennt die Kapuze) | „Und dieser Meister? Kyra hat Baris’ Leute von ihm reden hören.“ (Buch 1, Kapitel III: Baris’ Zelt) |
| `aufbruch.ts` Lia | „Wie Flick im Farn“ (nur Spielerwissen) | „Wie damals in der Böschung am Hof, als die Reiter vorbeikamen.“ (Kapitel I) |
| `pruefung.ts` Meister | „Sechzehn Jahre nichts“ (widerspricht Finale Buch 1) | „Erst die Nacht an der Eiche. Und jetzt leuchtest du wieder …“ |
| `flicks-erinnerungen.ts` Meister | Filmnahe Antwort mit „spannend“ | „Raus? Ich bin gerade erst angekommen. Und hier drin ist es so schön still.“ |
| `kyras-widerstand.ts` Meister | „Irgendwer oder irgendetwas“ (Filmwortlaut) | „Ob es ein Mensch ist oder ein Zauber, ich weiß es nicht. Aber etwas legt sich über sie.“ |
| `kyras-widerstand.ts` Kyra | Mutter „viel schlimmer als du“ | „Und die hatte wenigstens Honig dabei.“ |
| `flicks-verhoer.ts` Flick | Satzbau des Films („nichts … du nicht und …“) | „Ich hab schon Wölfen ins Maul geguckt, Kapuze. Die hatten bessere Zähne als dein verbrannter Hund.“ |
| `flicks-verhoer.ts`, `gefangene.ts` Meister | Gesicht als entstellt festgelegt | ausweichend: „Eins, das du nicht sehen wirst. Noch nicht.“ / „Mein Gesicht geht dich nichts an. Du wirst es früh genug sehen. Oder nie.“ |
| `gefangene.ts` Elnon | erfundene Gräueltat (verriegelte Türen) | „Mutig waren sie nur aus sicherer Entfernung. Wie du.“ |
| `catalog.ts` `e2-lore-rat` | Gwynns Gefangenschaft als Tatsache, Widerspruch „nur … und eine weitere“ | Valentus, Ignatius und Gwynn überlebten nach seinem Wissen; Gefangenschaft ist sein Glaube, Ort und Leben ungewiss. |
| `aufbruch.ts` Erzähler | „Keiner wusste, wo die anderen waren“ (Kyra und Elnon sind in derselben Halle) | „… Kyra und Flick. Und Elnon, was immer aus ihm geworden war. Lia wusste von alledem nichts.“ |
| `ignatius.ts` Lia | erkennt den Namen nicht, obwohl Kyra ihn genannt hat | „Ignatius? Der, von dem der Druide gesprochen hat? Ihr sitzt die ganze Zeit hier, kocht Tee und erzählt von den Zehn, als wären es Fremde!“ |
| Kurze Filmsätze | „Haltet sie fest!“, „nichts anhaben“, „Du lernst schnell“, „das mir zusteht“, „Wie hast du …“, „Ich will, dass es aufhört“ | „Packt sie! Nicht loslassen!“, „trinkt ihn wie Brunnenwasser“, „Schneller als ich damals. Viel schneller.“, „hat sich an meinem Eigentum vergriffen“, „Flick?! Was …“, „Ich will mein altes Leben zurück. Nur das.“ |
| `urmacht.ts` | „nannten sich der Rat“, hängender Nebensatz | „nannten sich den Rat der Zehn Geweihten. Immer zehn, damit keiner die Urmacht für sich allein nimmt.“ |
| `taverne.ts` | „Urlaub“ | „Festtag“ |
| Zeitangaben | „Wochenlang“ (Azar), „vor ein paar Wochen ein Flackern“ | „Tagelang“, „vor ein paar Tagen“ |

### Verworfen

| Befund | Grund |
| --- | --- |
| `bruderschaft.ts:339` „als hätte er seit Wochen nicht geschlafen“ | Redewendung über Elnons Aussehen, keine Zeitangabe zur Handlung. |
| Telefon quer: Gedankenwort „Kyr…“ am Kreisrand abgeschnitten | Kein Abschneiden: Gedanken treten vom Rand her ein und werden dort über die Deckkraft eingeblendet (`opacity` nach Radius); das Wort ist im Bild halb transparent. |
| Telefon hoch: Drehhinweis bei Direktstart verdeckt | Laut Befund gestalterisch, kein Fehler; liegt in der Titel-UI, nicht in Teil II. |
| Tafeln und Abspann | Befund ohne Fehler (sauber, Abspann vor dem Scrollen aufgenommen). |
| Kapitelwahl „PrologDie Urmacht“ | Vorbestehend, außerhalb von Teil II (`ui/chapters.ts`); nicht in diesem Durchgang geändert. |

### Offen (außerhalb von Teil II)

- `world/WorldScene.ts`: Klick-Interaktion verlangt `radius − 2`, E den vollen Radius. In Teil II durch die Elnon-Position umgangen; die Ungleichheit selbst bleibt für alle Karten bestehen.
- `ui/toast.ts`: Toasts liegen grundsätzlich über Tafeln und überdauern `G.goto` außerhalb von Teil II (Teil II räumt über `nextScene()` selbst ab).

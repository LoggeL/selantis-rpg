# RPG-Systeme für Die Chroniken von Selantis

Status: Erstes Spielkonzept, keine implementierten oder getesteten Systeme. Die Hauptfigur heißt LIA. Im verbindlichen Auftakt ist vorübergehend Valentus spielbar. Der Roman "Selantis 2" hat bis zum Ende des vorliegenden Manuskripts Vorrang vor den Filmen. Im Folgenden wird der Name im Fließtext als Lia geschrieben. Die Filmfigur Triss liefert Material für eine mögliche spätere Adaption. Romanbefunde stehen in [novel-analysis.md](novel-analysis.md), die Filme in den Episodennotizen. Festgelegt durch den Nutzer sind freie Erkundung in Echtzeit und separate rundenbasierte Rasterkämpfe, orientiert am Spielgefühl von Final Fantasy Tactics Advance. Die aktuelle Darstellung ist ein Pixelspiel im Desktop-Browser mit Phaser und Tilemaps: ein orthogonales 32 × 32-Raster mit schräg von oben gezeichneter Pixelkunst. Das Logikraster bleibt rechtwinklig; Höhe wird durch Ebenen und erkennbare Übergänge dargestellt. Die folgenden Detailregeln sind Designvorschläge.

## 1. Heldinnenreise mit einem festen Hauptplot

### Verbindlicher Auftakt: Valentus, dann Lia

Das Spiel beginnt mit einer spielbaren Schlacht. Der Spieler steuert den übermächtigen Valentus und lernt direkt den taktischen Rasterkampf. Die Schlacht aus seiner Erinnerung im Romanprolog liefert Energiestrahl und Druckwelle. Sie wird für das Spiel an den Anfang gestellt; konkretes Kampffeld, Gegnerwerte und Tutorialziel sind neue Adaptionsregeln. (Roman, S. 1 bis 6.)

Vorgeschlagenes Tutorialziel: einen deutlich markierten Frontabschnitt freimachen. Der erste Zug zeigt Bewegung und die Vorschau eines Energiestrahls, der nächste die Druckwelle mit mehreren Zielen. Beide sind von Anfang an verfügbar und sichtbar stark. Der Spieler löst das Ziel mit wenigen Zügen; Reihenfolge und Positionierung bleiben seine Entscheidungen. Kurze kontextbezogene Hinweise erscheinen nur bei Auswahl einer noch unbekannten Aktion. Die restliche Schlacht kann im Hintergrund sichtbar bleiben, ohne dass jede Figur eine steuerbare Einheit sein muss.

Erst wenn das Tutorialziel erfüllt ist, folgt der Schnitt zur Cutscene: Valentus wird verwundet, flieht, findet Zuflucht und erreicht die Wiege. Seine Verletzung wird als weiteres Storyereignis inszeniert. Das Spiel zwingt keine Niederlage durch plötzlich entzogene Lebenspunkte, verstärkte Gegner oder eine absichtlich unwinnbare letzte Runde. Ein tatsächlicher Fehlversuch startet den Tutorialabschnitt erneut. Nach erfolgreichem Ziel wird der Abschluss vor der Cutscene gesichert.

An der Wiege bleiben gewähltes Baby und übertragene Kraft ungeklärt. Die Kamera bestätigt Lia nicht durch eine eindeutige Zuordnung. Licht, Knall und Valentus' Verschwinden führen zum Zeitsprung. Danach übernimmt der Spieler Lia beim Lesen unter dem Baum. Eine feste Jahreszahl des Sprungs darf nicht als unbelegtes Alter Lias dargestellt werden.

Valentus' fertige Magie ist ein eigener Tutorialcharakter mit eigener Aktionsauswahl. Lebenswerte, Ausrüstung, Zauber und Erfahrung werden nicht auf Lia übertragen. Der Einstieg zeigt das mögliche Ausmaß der Welt, ohne Lias späteren Skillbaum zu öffnen. Lia beginnt unerfahren mit Level 1, kann bereits lesen und schreiben und besitzt zunächst keine eigenen Zauber. Ihre Bewegung, Wahrnehmung und Gespräche werden im Hofalltag gelernt.

Nach dem Zeitsprung folgt Lias Spielbeginn dem Roman: Lia liest unter einem Baum, begegnet Kyra, entdeckt den Überfall auf dem Heimweg und bleibt verborgen. Danach folgen die Bestattung der Eltern, Versorgung mit der Tinktur der Mutter, Reisevorbereitung und der Aufbruch nach Osten. Den Dolch des Vaters nimmt sie als Andenken und als Waffe mit; im Spiel ist er von ihrem ersten Kampf an ihr Angriff, geführt mit wenig Übung und viel Entschlossenheit. Nach dem Verlust der Eltern unterbricht kein Sammelauftrag die Dringlichkeit ihrer Suche nach Kyra. Die offene Erkundung entfaltet sich entlang der Handelsstraße; der erste sichere Hub ist das Lager der Freien Bruderschaft. (Roman, S. 6 bis 25 und 77 bis 82.)

Die belegten Ereignisse des Romans bilden die Kapitelpunkte und behalten ihre Reihenfolge. Das Manuskript endet am Anfang von Kapitel 6; eine spätere Fortsetzung aus den drei Filmen braucht eine ausdrückliche Entscheidung darüber, welche abweichenden Namen, Beziehungen und Ereignisse übernommen werden. Bis dahin bleibt sie eine eigene Adaptionsplanung. Zwischen den festen Kapitelpunkten entscheidet der Spieler, welche Orte er erkundet, wem er hilft und wie er auf eine Begegnung zugeht. Das Journal unterscheidet ein Hauptziel, optionale Aufträge und offene Hinweise. Ein Kapitelwechsel nennt vorher, welche offenen Aufträge betroffen sind.

| Fest durch die Romanadaption | Vom Spieler beeinflussbar |
| --- | --- |
| Lia als Hauptfigur und belegte Ausgangslage | Erkundungsreihenfolge innerhalb des aktuellen Kapitels |
| Zentrale Enthüllungen, Begegnungen und Wendepunkte | Vorbereitung, Gesprächston und lokale Lösungen |
| Für die Fortsetzung notwendige Ergebnisse | Nebenquest-Ausgänge, Kontakte und Skillverteilung |
| Die Reihenfolge der belegten Romanereignisse | Tempo, Rückkehr an bekannte Orte und optionale Entdeckungen |

Entscheidungen verändern Routen, Antworten, Wissen oder Nebenquest-Ausgänge. Die Hauptstory bietet keine Wahl an, eine notwendige Hauptfigur dauerhaft zu töten oder einen zentralen Konflikt vollständig zu überspringen. Ihre Grenzen müssen aus der Situation verständlich sein.

## 2. Offene Welt aus verbundenen Regionen

Die Zielstruktur ist eine offene Welt mit wiederkehrenden Orten und einem durchgehenden Hauptplot. Lia bewegt sich frei in Echtzeit durch Pixelkarten. Der Einstieg verwendet eine kleine, zusammenhängende Region mit Wegen, einer Rückkehrschleife und mehreren Abzweigungen. Weitere Regionen öffnen sich durch die Geschichte. Orte dürfen nach einem Wendepunkt andere Gesprächspartner, Hinweise oder Aufgaben haben. Die Welt muss dadurch keine bloße Folge einmaliger Kulissen bleiben.

Für den ersten Systemprototyp reichen drei miteinander verbundene Teilbereiche beim Bruderschaftslager. Die Verteilung von Lager, Trainingsplatz und kurzem Randweg ist eine Spielergänzung; Palisade, Wachtürme, Übung und Handwerk sind im Roman beschrieben. (S. 77 bis 82.) Ein direkter Hauptweg verbindet sie; ein anderer Weg ermöglicht Beobachtung oder eine optionale Aufgabe. Kein Teilbereich braucht eine lange Leerstrecke. Eine Karte zeigt entdeckte Orte und grobe Ziele, aber nicht jeden versteckten Gegenstand. Schnellreise kommt erst hinzu, wenn wiederholte Wege tatsächlich Zeit kosten.

Neue Regionen werden aus erzählerischen Gründen zugänglich, etwa nachdem ein belegter Übergang erreicht wurde. Unsichtbare Levelgrenzen passen schlecht zur Selbsterkundung von Lia. Ein gefährlicher optionaler Bereich kann sichtbar warnen und einen Rückweg anbieten. Die Hauptquest verlangt kein bestimmtes Ausrüstungsteil aus einer Nebenquest.

Die spätere Welt soll viele kleine, eigene Begegnungen enthalten. Nicht jeder NPC braucht eine Quest: Arbeit, ein persönliches Anliegen oder eine Beobachtung reichen für einen unterscheidbaren Charakter. Für den ersten Hub sind sechs bis acht ansprechbare Figuren ein Arbeitsziel; zwei davon bieten optionale Aufgaben. Diese Produktionsannahme muss mit den konkreten Romanfiguren und dem verfügbaren Ort abgeglichen werden.

## 3. Level, Erfahrung und Skillpunkte

Lia startet auf Level 1. Jeder Levelaufstieg gibt einen frei verteilbaren Skillpunkt und eine kleine automatische Verbesserung der Grundwerte. Der erste Vorschlag umfasst 20 Level für die vollständige Adaption. Diese Zahl gilt als Zielwert für ein später vollständiges Spiel und muss an Spielzeit und Inhalt angepasst werden. Das unvollständige Romanmanuskript wird dafür nicht künstlich gestreckt. Die Hauptquests allein bringen Lia zuverlässig auf die für das nächste Kapitel benötigte Stärke.

Für den isolierten Prototyp gilt eine einfache Arbeitskalibrierung: Sein Testspeicherstand beginnt mit Level 1 und null Erfahrung; 100 Erfahrungspunkte führen zu Level 2. Lagerorientierung und Hauptquest des Abschnitts vergeben zusammen 100 Punkte. Das ist keine Festlegung des Levels bei der Ankunft im vollständigen Spiel. Die beiden Nebenaufgaben und die erste Übung vergeben jeweils 25 Punkte. Level 3 erfordert im Test weitere 150 Punkte nach Level 2. Auch mit allen optionalen Aufgaben bleibt Lia damit auf Level 2 und erhält Fortschritt zum nächsten Level. Wiederholte Übungen vergeben keine weiteren Abschlusspunkte. Diese Zahlen sind Abstimmungswerte für einen späteren Prototyp.

Erfahrung belohnt gelöste Situationen. Flucht, Beobachtung, Gespräch und Kampf sind gleichwertig, wenn sie dasselbe Ziel erfüllen. Ein eigener Fund gibt einen kleinen Bonus. Kampf und Questabschluss zählen dieselbe Leistung nicht doppelt. Wiederholen und Nachladen erzeugen keinen Erfahrungsvorteil.

| Quelle | Regel für die spätere Abstimmung |
| --- | --- |
| Hauptquest | Genug Erfahrung für den folgenden Pflichtabschnitt |
| Nebenquest | Vergleichbare Belohnung für vergleichbaren Aufwand, unabhängig vom Lösungsweg |
| Einmalige Entdeckung | Kleiner Bonus, sobald ein relevanter Ort oder Hinweis erstmals verstanden wird |
| Wiederholte Standardhandlung | Kein erneuter Entdeckungs- oder Abschlussbonus |

Der Schwierigkeitsgrad beeinflusst gegnerischen Druck und Hilfen, nicht die Erfahrung. Ein ruhiger Spielstil bleibt ein vollwertiger RPG-Weg. Schwierige Nebenaufgaben geben nützliche Optionen und eigene Folgen. Sie finanzieren keine verpflichtende Grindstrecke.

### Skillbäume und Selbsterkenntnis

Drei kleine Bäume mit jeweils sechs bis acht Knoten reichen als Ausgangspunkt. Jeder Knoten kostet einen Punkt; spätere Knoten setzen wenige Vorgänger voraus. Der Spieler verteilt beim ersten Levelaufstieg einen Punkt und kann ihn an einem sicheren Ort kostenlos neu verteilen. Dadurch kann er einen Build ausprobieren, bevor er dessen Wirkung vollständig kennt.

| Baum als Designvorschlag | Frühe Wirkung | Grenze |
| --- | --- | --- |
| Wahrnehmung und Erkundung | Hinweise früher erkennen, sichere Wege besser lesen, Spuren zuordnen | Wichtige Hauptquest-Hinweise bleiben auch ohne Investition auffindbar |
| Umgang und Wissen | Zusätzliche Rückfragen, besserer Zugang zu optionalen Informationen und lokalen Lösungen | Kein Skill ersetzt eine kanonische Enthüllung oder kontrolliert andere Figuren |
| Handlung und Überleben | Bessere Ausdauer, Versorgung mit bekannten Mitteln, zuverlässigere Flucht und später erlernter Umgang mit dem Familiendolch | Versorgung, Kräuterlexikon und Dolchbesitz sind belegt; eigene Tinkturbrauerei und Kampftechniken wären Ergänzungen |

Als erste Knoten werden vorgeschlagen: "Aufmerksamer Blick" markiert nach aktivem Untersuchen eine weitere optionale Spur; "Geduldiges Nachfragen" öffnet eine zusätzliche Rückfrage bei einem Nebenquest-NPC; "Sorgfältige Versorgung" verbessert den Spielwert einer vorhandenen Verbandsanwendung. Diese Effekte sind Spielergänzungen. Lias Bücher und vorhandene Mittel rechtfertigen zunächst Beobachtung und Versorgung, keine frei erfundene Tinkturbrauerei.

Die Bäume behaupten keine zusätzlichen Eigenschaften Lias im Roman. Besondere Talente werden später durch ein entsprechendes Storyereignis freigeschaltet; Skillpunkte entwickeln deren Kontrolle. Im Manuskript entdeckt Lia keine eigene Magie. Der Spieler kauft ihre Herkunft oder eine vermeintlich bestätigte Urmacht nicht frei. Übernommene Filmkräfte müssen mit ihrer belegten Wirkung vereinbar bleiben.

Gesundheit und Ausdauer sind vorgeschlagene Spielwerte. Ein eigenes Magie- oder Ressourcenmodell für Lia gehört erst in eine spätere Fortsetzung, wenn Auslöser, Grenzen und Folgen der übernommenen Fähigkeiten geklärt sind. Valentus verwendet im Auftakttutorial eine separate, vorgegebene Aktionsauswahl; diese ist kein Vorgriff auf Lias Progression. Ein einzelner sichtbarer Effekt begründet kein Arsenal von Elementzaubern.

## 4. Freie Erkundung und taktische Kämpfe

Nach dem Valentus-Auftakt bleibt Lia die gesteuerte Hauptfigur beim Erkunden. Gegner oder eine eindeutig angekündigte Begegnung führen in einen eigenen taktischen Modus. Die Referenz Final Fantasy Tactics Advance beschreibt die gewünschte Richtung: kleine Gruppen, Positionierung und überlegte Züge. Dessen Figuren, Grafik, Job- und Gesetzessystem werden dafür nicht übernommen.

### Übergang und Rückkehr

Vor Beginn werden Weltposition, Questzustand und beteiligte Figuren gesichert. Das lokale Kampffeld greift Ort und Hindernisse der Begegnung auf. Eine kurze Kamerafahrt und eingeblendete Felder zeigen den Moduswechsel. Nach Sieg, friedlicher Einigung oder Rückzug kehrt Lia an einen sinnvollen Punkt derselben Weltkarte zurück. Gelöste Begegnungen bleiben gelöst; die Rückkehr löst nicht sofort denselben Kampf aus.

Für Lias erste Übung reichen ein orthogonales Raster von ungefähr 8 × 8 Feldern, zwei Höhenstufen, ein Hindernis und höchstens drei Figuren pro Seite. Die Zeichnung von schräg oben ändert weder Nachbarschaft noch Reichweiten. Höhere Felder bekommen eine sichtbare Kante und einen erreichbaren Aufstieg. Höhen und Wege sind sichtbar. Eine Kiste blockiert beispielsweise Bewegung und Sicht; eine kleine Anhöhe ist über eine erkennbare Stufe erreichbar. Das sind Produktionsvorschläge, keine vermessenen Filmorte.

### Ein Zug: bewegen und handeln

Eine sichtbare Reihenfolge zeigt die nächsten Figuren. Vorgeschlagen ist eine Initiative nach Geschwindigkeit, die sich nach jedem abgeschlossenen Zug fortsetzt. Sie ist unsere Regel, keine Behauptung über den genauen Ablauf der Referenz. Der Spieler wählt zuerst eine erreichbare Position und anschließend eine Aktion. Bewegung lässt sich bis zur bestätigten Aktion zurücknehmen; danach ist der Zug verbindlich. Warten ohne Bewegung ist erlaubt. Es gibt keine Reaktionszeitprüfung.

Für Lias frühe Kämpfe genügen fünf Aktionen. Valentus besitzt im Auftakt stattdessen seine vorgegebenen Magieaktionen:

| Aktion | Erste taktische Wirkung |
| --- | --- |
| Grundangriff | Benachbartes Ziel mit Vaters Dolch angreifen, von Anfang an verfügbar |
| Abwehren | Bis zum nächsten eigenen Zug Schaden von vorne verringern |
| Unterstützen | Ein vorhandenes Verbandmittel bei sich oder einem Nachbarn einsetzen |
| Interagieren | Ein markiertes Begegnungsziel bedienen oder erreichen |
| Warten | Zug beenden und Blickrichtung wählen |

Erreichbare Felder, Aktionsreichweite und Vorschau erscheinen erst bei Auswahl. Der Spieler sieht vor Bestätigung Ziel, Wirkung und Kosten. Vorgeschlagen: Ein seitlicher Angriff umgeht frontales Abwehren; ein Angriff von hinten erhält einen kleinen Schadensbonus. Eine erhöhte Position erweitert bei einer passenden Fernkampfaktion die Reichweite um ein Feld. Sichtblockaden bleiben wirksam. Höhen verändern also konkrete Entscheidungen, nicht nur die Grafik. Fernkampf steht nur einer Figur zur Verfügung, deren Ausrüstung ihn rechtfertigt; Lia erhält nicht automatisch Foltans Armbrust.

Die Blickrichtung wird am Zugende festgelegt. Kampferfolg entsteht durch Wege, Positionen und gegenseitige Hilfe. Wenige klare Ziele, etwa einen Rückzug decken oder einen Weg erreichen, können Kämpfe abwechslungsreicher machen als die regelmäßige Vernichtung sämtlicher Gegner.

### Lia lernt, Gefährten helfen

Beim Aufbruch nimmt Lia den Familiendolch mit. Im Spiel ist er von ihrem ersten Kampf an ihr Grundangriff: Sie führt ihn unsicher und ist die schwächste Kämpferin der Gruppe, aber sie kämpft. Trauer, Angst und Rachewunsch nach dem Tod der Eltern zeigen sich als passive Eigenschaft „Verzweiflung“: Schwer verletzt sticht sie härter und genauer zu. Die Übung an der Palisade lehrt sie Ausweichen und Ablenken. Der Roman zeigt dort Training anderer Mitglieder; diese Unterweisung Lias ist eine neue Spielszene. (S. 81.) Daneben kann sie Position beziehen, unterstützen und interagieren. Magie bleibt im Romanabschnitt unentdeckt; die Urmacht wächst erst nach der Rettung (Lichtstoß), in Teil II mit dem Stab.

Vorgeschlagen ist die Kontrolle eines kleinen Teams während Kämpfen, zunächst Lia mit Foltan und Azar. Das erweitert den Nutzerwunsch um eine noch zu prüfende Detailentscheidung. Die Begleiter sind zeitweise anwesend und folgen ihren Storybedingungen; Lia bleibt die zentrale Figur. Foltans militärische Erfahrung und Azars Handwerk bieten unterschiedliche Rollen, ohne Azar zur unbelegten starken Kämpferfigur zu machen. Flick kommt erst für eine entsprechend geplante spätere Filmadaption infrage. Ein zusätzliches Rekrutierungssystem ist zunächst nicht nötig.

Rückzug ist ein angekündigtes Begegnungsziel: Eine Einheit erreicht den sichtbaren Ausgang und wählt den Gruppenrückzug, sofern die Begegnung ihn erlaubt. Die Rückkehrposition und örtliche Folge sind vor Bestätigung erkennbar. Eine Niederlage lädt den Begegnungsbeginn. Die erste Übung endet ohne Tod oder permanenten Schaden und lässt sich abbrechen.

### Ruhige Oberfläche, gezielte Informationen

Beim Erkunden bleiben kleine Symbole für Journal, Gepäck und Skills sichtbar. Ortsnamen erscheinen beim Betreten; Namen von NPCs bei Annäherung oder Auswahl. Tooltips erklären Symbole auf Nachfrage. Dauerhafte Erklärungstexte und vollständige Skillbeschreibungen verdecken keine Spielwelt. Das Ziel ist über das Journal-Symbol erreichbar.

Im Kampf genügen aktive Figur, kurze Zugfolge, Lebensanzeige und Aktionssymbole. Das ausgewählte Symbol öffnet Namen und Wirkung; ein ausgewählter Skill zeigt seine Beschreibung im Menü. Reichweite, Höhe und Richtung werden auf dem Feld dargestellt. Dialogtexte bleiben während eines Gesprächs sichtbar, mit zwei bis vier kurzen Antworten. Pflichtinformationen haben alternative Zugänge durch Untersuchung oder Gespräch. Skillprüfungen erschließen zusätzliche lokale Lösungen, ohne kanonische Enthüllungen zu ersetzen.

## 5. Nebenquests mit lokalen Folgen

Nebenquests ergänzen die Romanhandlung in ihren offenen Räumen. Neu geschriebene Figuren, Namen und Ereignisse erhalten im späteren Inhaltsplan das Kennzeichen "Spielergänzung". Sie dürfen keine widersprüchliche Vergangenheit für Romanfiguren schaffen.

Zwei unabhängige Aufgaben reichen für den Prototyp: eine persönliche Begegnung und eine Entdeckung mit mehreren Lösungswegen. Konkrete Vorschläge stehen in Abschnitt 7.

Ein Auftrag braucht ein eigenes Motiv des NPC, eine Handlung des Spielers und eine sichtbare Folge. Belohnungen kombinieren Erfahrung mit Wissen, einer späteren Gesprächsoption oder einer örtlichen Erleichterung. Ein seltenes Ausrüstungsteil ist möglich, sobald Ausrüstung als System begründet ist. Die Aufgabe bleibt auch ohne solchen Gegenstand erinnerbar.

Der Spieler darf ablehnen, einen Auftrag liegen lassen oder einen lokalen Fehler machen. Ein Zeitlimit gilt nur, wenn es vorher angekündigt wurde und inhaltlich sinnvoll ist. Misslingen kann zu einer anderen Antwort oder einer verlorenen optionalen Belohnung führen. Es blockiert die Hauptstory nicht. Ein NPC kann nach einer abgelehnten Bitte weiterhin eine andere Rolle im Ort haben.

## 6. Questzustand, Scheitern und Speichern

Für einen späteren Prototyp besitzt jede Quest eine stabile Kennung und die Zustände unbekannt, angeboten, aktiv, abgeschlossen, gescheitert oder abgelehnt. Teilziele, Lösungsweg und einmal ausgezahlte Belohnungen werden getrennt gespeichert. Voraussetzungen prüfen erzielte Ereignisse und verfügbare Figuren, nicht die Reihenfolge beliebiger Klicks.

Notwendige Hauptziele sind gegen Sackgassen geschützt: Ein verlorener Pflichtgegenstand bleibt wiederbeschaffbar; ein verpasster Hinweis erhält einen anderen Zugang. Niederlage lädt den Anfang der Begegnung mit dem damaligen Questzustand. Sie verändert keine festgelegten Romanereignisse dauerhaft. Abgeschlossene Nebenquests können bei einer Rückkehr eine neue Reaktion auslösen, aber nicht erneut ihre Belohnung auszahlen.

Ein versionierter Spielstand enthält Kapitel, Position, Level, Erfahrung, Skills, Aktionen, Inventar, Quests, NPC-Vertrauen und ausgelöste Szenen. Ein Kampfspeicherstand ergänzt Begegnungskennung, Welt-Rückkehrposition, Figuren mit Feldern/Höhe/Blickrichtung, Lebens- und Statuswerten, Initiative, aktuellen Zug und noch verfügbare Aktion. Falls Zufall verwendet wird, wird dessen Seed samt Fortschritt gesichert. Laden an einer Zuggrenze erzeugt denselben Ausgangszustand statt neue Würfe. Autosaves entstehen an sicheren Orten, nach wichtigen Abschlüssen und vor Kapitelwechseln. Mehrere manuelle Stände und ein Stand vor unumkehrbaren Übergängen bleiben zusätzlich erhalten.

Der Auftakt speichert außerdem Tutorialziel, ausgewählte Valentus-Aktionen, Tutorialabschluss und den aktuellen Abschnitt der Folge Schlacht, Flucht, Zuflucht, Wiege, Lia. Er hält Valentus- und Lia-Zustände getrennt. Laden nach erfülltem Tutorialziel startet die folgende Cutscene und erzwingt keinen erneuten Kampf.

Gespräche und Cutscenes speichern an ihren Anfangs- oder Endpunkten. Laden wiederholt keine Belohnungen oder abgeschlossenen Enthüllungen. Cutscenes sind überspringbar; das Journal hält ihren Inhalt fest.

## 7. Abnahme des Auftakts und späterer Systemausschnitt

Der erste kleine Umsetzungsschritt prüft den neuen Auftakt. Für seine spätere Abnahme gilt:

- Der Spieler kann Valentus bewegen, beide Magieaktionen auswählen und das Tutorialziel mit eigenen Zügen erfüllen.
- Der Schnitt zur Verwundung erfolgt erst nach Zielerfüllung; keine künstliche Lebenspunkt-Niederlage löst ihn aus.
- Flucht, Zuflucht, mehrdeutige Wiege und Zeitsprung folgen in dieser Reihenfolge.
- Nach dem Zeitsprung heißt die gesteuerte Figur LIA. Sie erhält weder Valentus' Zauber noch dessen Werte oder Erfahrung.
- Laden vor und nach dem Tutorialabschluss setzt den richtigen Abschnitt fort; Überspringen der folgenden Cutscene führt zum selben Lia-Startzustand.

Der zusätzliche 20 bis 30 Minuten lange Systemausschnitt prüft später die offene Struktur am ersten Hub der Freien Bruderschaft. Er zeigt einen Ausschnitt nach dem Reisebeginn und entspricht nicht den ersten 30 Minuten des fertigen Spiels. Eine kurze vorgeschaltete Zusammenfassung erklärt Lias Suche nach Kyra. Der verbindliche Auftakt aus Abschnitt 1 wird dafür nicht durch eine Lager-Zusammenfassung ersetzt.

Palisade, Training, Handwerk und Lagergespräche sind als Umgebung belegt. (Roman, S. 77 bis 82.) Zusätzliche Aufgaben sind bewusst neue Spielinhalte: Eine verlorene Materialtasche lässt sich suchen oder durch Befragung finden; eine Lagerfigur bittet Lia, einen Brief vorzulesen. Daneben bietet Foltan eine freiwillige Einführung mit einer kurzen Bewegungs- und Abwehrübung an. Danach folgt eine nicht tödliche 3-gegen-3-Begegnung: Lia, Foltan und Azar gegen drei namenlose Übungspartner. Sie übt den Dolchangriff, Flanken, Unterstützung und Rückzug. Alle drei Aufträge sind ablehnbar. Lesen ist bereits verfügbar; Magie nicht.

Der Hauptweg führt durch eine als Spielergänzung angelegte Orientierung im Lager und zu Lias beabsichtigtem Besuch bei Elnon. Die Orientierung gibt die Hauptquest-Erfahrung, bevor der Besuch beginnt. So kann der Spieler seinen Skillpunkt noch im ruhigen Lager ausprobieren. Der Übergang zum Zelt weist auf verbleibende optionale Aufgaben hin. Dort hört Lia die kanonische Information über Foltans verschwiegenes Wissen und fühlt sich verraten. Der Abschnitt endet hier, bevor ihre Flucht in den Wald beginnt. (S. 82 bis 90.) Nebenquests öffnen keine frühere vollständige Offenlegung der Lüge und lösen diesen Hauptkonflikt nicht auf. Nach der Enthüllung wird keine Sammelrunde ins Lager eingeschoben.

| Ungefähre Spielzeit | Inhalt und Zweck |
| --- | --- |
| 0 bis 3 Minuten | Reisezusammenfassung, Lias Ziel und aktueller Standort |
| 3 bis 8 Minuten | Lager, Trainingsplatz und Randweg entdecken, mit Azar sprechen |
| 8 bis 17 Minuten | Freiwillige Unterweisung und kurze 3-gegen-3-Rasterübung, anschließend Rückkehr ins Lager |
| 17 bis 23 Minuten | Orientierung abschließen, Levelaufstieg erreichen, Skillpunkt zuweisen und Wirkung ausprobieren |
| 23 bis 30 Minuten | Zum Zelt übergehen, kanonische Information hören, Abschnitt beenden und Abschluss speichern |

Der Durchlauf mit taktischer Übung soll 25 bis 30 Minuten dauern, eine friedliche Route mit einer Nebenbegegnung ungefähr 20 Minuten. Die Übung prüft Lias frühen Kampf und den Wechsel aus der freien Welt. Valentus' Schlacht wird separat am Auftakt geprüft. Die Hauptstory lässt sich auch ohne sie fortsetzen. Zeiten und Erfahrung sind Planungswerte; nichts wurde gebaut oder gemessen. Der Ausschnitt zieht keine Magieentdeckung oder Rettung Kyras vor.

Ein späterer Prototyp gilt als abgenommen, wenn ein beobachteter Spieltest Folgendes zeigt:

- Ein neuer Spieler versteht, wen er steuert, warum Lia Kyra sucht und was sein nächstes Ziel ist.
- Drei verbundene Teilbereiche lassen sich frei besuchen; ein sinnvoller Weg führt zum bekannten Ort zurück.
- Der Hauptweg erreicht die belegte Enthüllung, unabhängig davon, welche Nebenaufgabe vorher bearbeitet wurde.
- Zwei optionale Aufgaben lassen sich entdecken. Materialsuche und Befragung bilden unterschiedliche Lösungen, etwa mit anderer NPC-Reaktion.
- Der reine Hauptweg liefert den Levelaufstieg. Der Spieler kann einen Skillpunkt zuweisen und dessen Wirkung erkennen.
- Der Wechsel von freier Bewegung zum Rasterkampf und zurück erhält Position, Questzustand und beteiligte Figuren.
- Eine kurze 3-gegen-3-Übung zeigt Initiative, Bewegung plus Aktion, Höhe, Blickrichtung, Unterstützung und einen funktionierenden Rückzug ohne Reaktionszeitprüfung.
- Hauptquest-Erfahrung reicht ohne Übung. Gleichwertige friedliche und kämpferische Lösungen erhalten dieselbe Abschluss-Erfahrung; wiederholte Übung erzeugt keinen Grindvorteil.
- Speichern und Laden an einer Zuggrenze erhalten Kampfzustand und gegebenenfalls Zufallsfortschritt. Entscheidungen und Belohnungen bleiben außerhalb des Kampfes ebenfalls erhalten.
- Die normale Spielansicht bleibt ohne dauerhafte erklärende Textblöcke bedienbar; Symbole und Auswahlinformationen reichen im beobachteten Test aus.
- Ablehnung, Fehlversuch oder unterbrochene Nebenaufgabe lassen die Hauptstory erreichbar.
- Eine Testperson erreicht den vorgesehenen Abschluss in 20 bis 30 Minuten; Abweichungen führen zur Anpassung von Route und Aufgabenlänge.

Die Umsetzung beginnt mit Valentus' spielbarer Schlacht und dem Übergang zu Lia auf dem Hof. Der Bruderschaftsausschnitt folgt als separater Systemtest mit freier Bewegung und Lias kleiner Übung. Die Regeln und Kampftechnik der Unterweisung müssen noch abgestimmt werden. Eine spätere Übernahme der Filmkräfte bleibt eine eigene Inhaltsentscheidung. Weitere Kämpfe, größere Regionen und zusätzliche Skills folgen erst nach dem kleinen Abschnitt.

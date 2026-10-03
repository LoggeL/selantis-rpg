# Romananalyse für das Selantis-RPG

Stand: 3. Oktober 2026. Primärquelle ist `/Users/logge/Downloads/Roman Selantis 2.pdf`. Alle 90 PDF-Seiten wurden gelesen. Seitenangaben beziehen sich auf die Reihenfolge im PDF, nicht auf gedruckte Seitenzahlen. Die Quelle hat keine gedruckte Seitennummerierung, kein Inhaltsverzeichnis, keine PDF-Lesezeichen, keine Karte und keine eingebetteten Bilder. Die erste und letzte Seite wurden zusätzlich gerendert und visuell geprüft.

Die Hauptfigur heißt im gesamten vorliegenden Roman Lia. Im Spiel wird der vom Nutzer gewünschte Name LIA verwendet. Der Nutzer legt fest, dass der Roman bis zum Ende seines erzählten Abschnitts Vorrang vor den Filmen hat. Abweichende Filmnamen, Kostüme oder Ereignisse verändern deshalb den Spielanfang nicht. Die Filme liefern anschließend Material für die Fortsetzung. Die Datei enthält 21.234 durch Leerraum getrennte Wörter, einschließlich Kapitelüberschriften und zweier Schlussnotizen. Der Originaltext wurde nicht verändert. Die Extraktion in `sources/novel/roman-selantis-2.txt` und `sources/novel/roman-selantis-2.json` bewahrt die PDF-Seitengrenzen; nur der technisch zerstückelte Leerraum wurde zusammengeführt. Die JSON-Datei enthält Pfad, Seitenzahl, Metadaten und SHA-256 des Originals.

## Reichweite der Quelle

Der Roman ist ein unvollständiges Manuskript. Er enthält einen Prolog, fünf weitgehend ausgearbeitete Kapitel und den Anfang von Kapitel 6. Er endet während Lias Flucht aus dem Lager der Freien Bruderschaft und Foltans Scham über seine Lüge. Auf Seite 90 stehen anschließend die Arbeitsnotizen "Lia alleine im Wald" und "Lia haut enttäuscht ab". Eine Rettung Kyras, Lias Entdeckung eigener Magie, die tatsächliche Fundstelle des Geweihs und ein Ende sind in dieser Datei nicht erzählt.

Das Manuskript liefert besonders viel für den Anfang des Spiels, die Beziehungen der Hauptfiguren, die politischen Spannungen, das Lagerleben und mögliche Nebenbegegnungen. Die spätere Heldenreise braucht zusätzliche Filmbelege oder ausdrücklich als Adaption bezeichnete Entwürfe. Die Aussage des Nutzers, dass die Figuren ansonsten gleich seien, ist eine Arbeitsvorgabe für die Adaption. Sie ersetzt keine Prüfung konkreter Unterschiede zwischen Roman und Film.

| Abschnitt | PDF-Seiten | Schwerpunkt |
| --- | --- | --- |
| Prolog | 1 bis 6 | Valentus auf der Flucht, Rückblick auf eine Schlacht, zwei Säuglinge und ein magischer Vorgang |
| Kapitel 1 | 6 bis 22 | Alltag der Schwestern, Überfall, Bestattung, Lias Reisevorbereitung |
| Kapitel 2 | 22 bis 40 | Erste Nacht, Foltan und Azar; Kyras erfolgloser Hilferuf im Gasthaus |
| Kapitel 3 | 40 bis 55 | Reise mit den beiden Männern, Goldener Eber, Geschichte des Krieges und Foltans Desertion |
| Kapitel 4 | 55 bis 71 | Kyras Ankunft bei Baris; Lesen am Lagerfeuer, gegenseitige Versprechen |
| Kapitel 5 | 71 bis 88 | Suche nach einer Grotte, Freie Bruderschaft, Geweih Regas, Foltans verschwiegenes Wissen |
| Kapitel 6, Anfang | 88 bis 90 | Lia verlässt das Lager, Sommerregen, Azar sucht sie, Foltan schämt sich |

## LIA als spielbare Hauptfigur

### Belegtes Aussehen und Ausrüstung

Lia hat lange rotblonde Locken. Beim Lesen sind sie am Hinterkopf zusammengesteckt; vor dem Aufbruch bändigt sie die Locken mit einem Haarband und richtet sie ebenfalls am Hinterkopf. Ihre Gestalt ist schlank, ihre Beine werden später als dünn beschrieben. Sie trägt eine weiße Bluse und einen braunen Rock. Zum Lesen ist sie barfuß; auf dem Heimweg trägt sie Holzschuhe. Für die Reise wechselt sie wegen der wundgescheuerten Ferse auf leichte Lederschuhe, deren Bänder sie um die Knöchel schnürt. Ihr langer grüner Mantel ist ein Regenmantel, den sie einpackt und später als Unterlage und Wärmeschutz verwendet. (S. 8 bis 10, 12, 19 bis 20, 23, 60, 75 bis 76, 89.)

Zur Reiseausrüstung gehören ein großer Lederbeutel, ein Wasserschlauch, eine mit Riemen befestigte Wolldecke, ein Dolch in einer Lederscheide, zwei Bücher und Proviant. Aus dem Geheimfach ihres Vaters nimmt sie 22 Kupfermünzen und sieben Silbermünzen. Sie versorgt die Ferse mit der Tinktur ihrer Mutter und Stoffstreifen aus einem alten Laken. Sie beginnt mit Speck, einem halben Laib Käse und zwei Broten. (S. 18 bis 21.)

Die Augenfarbe, genaue Körpergröße und ein genaues Alter Lias sind nicht angegeben. Das Manuskript nennt sie ein junges Mädchen und behandelt sie gesellschaftlich als Kind; sie wehrt sich wiederholt dagegen. Die 14 Jahre seit Dunkelhain sind ausdrücklich genannt, aber nicht ausdrücklich als ihr Alter. Die Frau, die Valentus versorgt, hat grüne Augen und rötliche Locken. Diese Augenfarbe darf nicht ohne weiteren Beleg Lia zugeschrieben werden. Eine feste Altersangabe wäre eine Entscheidung für die Spieladaption. (S. 2, 9, 17, 23, 29, 48, 79.)

Für Bildkonzepte ist deshalb eine schlanke junge Reisende mit rotblonden, am Hinterkopf gebundenen Locken, weißer Bluse, braunem Rock, grünem Mantel, einfachen Lederschuhen und kleinem Reisegepäck die engste Romanreferenz. Rüstung, Stab, Schwert, leuchtende Augen oder sichtbare Zaubermale sind zusätzliche Entwürfe. Der Familientolch ist belegt, eine geübte Verwendung im Kampf ist es nicht.

### Persönlichkeit und Entwicklung

Zu Beginn zieht sich Lia lieber in Bücher zurück, als ihrer Schwester bei der Arbeit zu helfen. Sie verliert beim Lesen das Zeitgefühl, hält ihren Hof für öde und stellt sich Abenteuer als Geschichten von Helden und Königstöchtern vor. Ihre Mutter hat ihr Lesen und Schreiben beigebracht. Lia interessiert sich für Mythologie und erkennt Zusammenhänge, die ihren Begleitern fremd sind. Sie ist keine bereits ausgebildete Kämpferin. (S. 7 bis 12, 21, 32, 61 bis 62.)

Der Überfall führt zuerst zu Schock, Trauer und innerer Leere. Lia versteckt sich, kann nicht eingreifen und wirft sich später vor, nur im Gebüsch gesessen zu haben. Ihr erstes bewusstes Ziel ist ausschließlich die Rettung ihrer Schwester, der letzten nahen Angehörigen. Sie bestattet ihre Eltern, bereitet die Reise selbst vor, versorgt ihre Verletzung und lässt die Schweine frei. Diese Handlungen zeigen Fürsorge und Eigeninitiative. Die Quelle macht aus ihrer Angst keinen dauerhaften Charakterfehler. (S. 13 bis 22.)

Unterwegs bleibt sie misstrauisch, widerspricht Autoritäten, erkennt die Schwächen Foltans und Azars und begegnet ihnen zunehmend mit trockenem Humor. Sie schont Azars Stolz, als sie eine Rast auch in seinem Interesse unterstützt. Ihr Lesen verändert das Verhältnis: Aus der vermeintlich hilflosen Kleinen wird jemand, der der Gruppe Wissen und Trost geben kann. Am Lagerfeuer spricht sie offen über Einsamkeit und Überforderung und verlangt ein verbindliches Versprechen. Als dieses Versprechen gebrochen wird, wendet sie sich von den Erwachsenen ab. (S. 27 bis 32, 41 bis 44, 61 bis 67, 76, 82 bis 90.)

Als RPG-Figur trägt Lia deshalb Lernen, Beobachten, Lesen, Improvisation und die Entscheidung, anderen zu vertrauen. Ein Einstieg als mächtige Magierin würde die im Roman gezeigte Entwicklung überspringen. Ein späterer Ausbau um Magie kann zur angedeuteten Herkunft passen, braucht aber Filmbelege oder eine deutlich benannte Spielentscheidung.

## Vollständiger Handlungsverlauf

### Prolog: Hoffnung auf der Flucht

Ein schwer verletzter, grauhaariger Mann flieht bei Mondlicht vor Verfolgern und Hunden. Er bricht zusammen und wird von einem Paar versorgt. Sein Name ist Valentus. Ein Fiebertraum zeigt eine große Schlacht: Hinter ihm kämpfen die Paladine des Lichts, die achte und elfte Brigade aus Ebaril und die Falken aus Portas gegen schwarz gekleidete Kämpfer. Valentus setzt einen tödlichen Energiestrahl und eine Druckwelle ein. Er erwacht und fürchtet, die Verfolger würden auch seine Retter töten. (S. 1 bis 5.)

Valentus glaubt, sterben zu müssen. Er betrachtet etwas in seinem Besitz oder Wesen als letzte Hoffnung für Selantis und will es weitergeben. In einer Wiege liegen zwei Säuglinge. Er hält die Hand über den Kopf eines der Kinder, ein blauer Schimmer entsteht, dann folgen grelles Licht und ein Knall. Valentus ist verschwunden, beide Kinder schreien. Die Szene legt eine Übertragung nahe, benennt aber weder die übertragene Kraft noch das gewählte Kind. Der Text sagt an dieser Stelle nicht, dass die Kinder Lia und Kyra sind. Diese Zuordnung ist eine naheliegende Lesart des anschließenden Zwillingsmotivs, keine ausdrücklich ausgesprochene Information. Auch Valentus' Verschwinden ist kein eindeutiger Nachweis seines Todes. (S. 5 bis 6.)

### Kapitel 1: Ein konkreter Verlust

Kyra kehrt wütend vom Holzsammeln zurück. Lia hat die Arbeit erneut vergessen, weil sie unter einem Baum liest. Die Schwestern streiten und necken sich. Lia verspricht, die Schweine zu füttern. Die Familiengeschichte erklärt ihren vergleichsweise gut versorgten Bauernhof: Ihre Mutter stammt aus einer wohlhabenden Händlerfamilie in Trapas und hat einen Bauern geheiratet. Der Vater bringt vom Markt Bücher oder Honiggebäck mit. Lia wird als lesende, verträumte Schwester, Kyra als fleißigere und weniger lernwillige Schwester eingeführt. (S. 6 bis 12.)

Auf dem Heimweg entdeckt Lia Dunkelschatten auf dem Hof und versteckt sich in einer Böschung. Vier stehen zunächst bei den Eltern, ein fünfter bringt Kyra aus dem Haus. Der grauhaarige Anführer ermordet den Vater und anschließend die Mutter. Kyra wird trotz heftiger Gegenwehr gefesselt und mitgenommen. Lia bleibt unentdeckt. Sie schwört, ihre Schwester zu retten. Über Nacht errichtet sie Steingräber, nimmt Vorräte und das verborgene Geld ihres Vaters, versorgt ihre Füße und packt Mantel, Decke, Familientolch und Bücher ein. Zum Schluss öffnet sie das Schweinegatter und verlässt den Hof nach Osten, wohin die Entführer geritten sind. (S. 13 bis 22.)

### Kapitel 2: Zwei Wege durch dieselbe Welt

Lia gelangt vom Feldweg auf die Hauptstraße. Im Westen liegt Trapas, im Osten führt der Weg über viele Orte bis nach Portas. Sie entscheidet sich für Osten, weil die stark besetzte Stadt Trapas ihr als unwahrscheinlicher Aufenthalt der Dunkelschatten erscheint. Händler und eine Gauklertruppe begegnen ihr; Letztere reist zum Verbannungsfest nach Trapas. Die Straße ist durch die Gewalt weniger belebt, als Lia erwartet hatte. Sie schlägt ihr erstes Lager im Wald etwa hundert Meter abseits der Straße auf und entfacht mühsam ein Feuer ohne den vergessenen Zunder. (S. 22 bis 25.)

Foltan und Azar entdecken sie in der Nacht. Nach einem komischen, aber für Lia bedrohlichen Missverständnis wird sie gefesselt. Foltan ist ein ehemaliger Leutnant der Stadtgarde von Portas, Azar ein Schmied aus Ignis. Die Männer gehören einer gegnerischen Organisation der Dunkelschatten an. Lia erzählt von ihrem Schicksal und hofft auf Hilfe. Die Männer nehmen sie mit, ohne sofort eine Rettung zusagen zu können. Über dem Lager steht Crios, ein westlicher Stern, den Lia aus ihren Büchern kennt. (S. 25 bis 32.)

Der Text wechselt zu Kyra. Sie hat einen ihrer Entführer gebissen und muss deshalb gefesselt hinter den Pferden laufen. Der Gebissene wird von seinen Kameraden fortan "Mädchen" genannt. Die Gruppe erreicht ein Gasthaus mit Eberschild, in dem Kyra an einen Pfosten gebunden wird. Sie bittet einen Zwerg um Hilfe, nachdem sie ihn absichtlich stolpern lässt. Er weist sie grob zurück. Die anderen Gäste haben Angst. Der graue Entführer erklärt, dass sie als Dienstmädchen für einen Hauptmann bestimmt ist, dessen bisherige Dienerinnen getötet wurden. In der Nacht liegt Kyra angekettet im Stall und schaut ebenfalls auf Crios. (S. 33 bis 40.)

### Kapitel 3: Hilfe mit einer Vorgeschichte

Lia wandert mit Foltan und Azar durch den Wald. Foltan erklärt, dass sie Freischärler sind und ihr Lager noch ungefähr einen Tagesmarsch entfernt liegt. Vielleicht hätten andere Späher die Entführer gefunden. Lia besteht darauf, nicht wie ein abwesendes Kind besprochen zu werden. Parallel bringt der gebissene Dunkelschatten Kyra ein gestohlenes Schminktäschen. Die Männer wetten, wie lange sie beim Hauptmann überleben wird. Nun wird der Grauhaarige als Orwen benannt, rechte Hand des Hauptmanns. (S. 40 bis 46.)

Lia, Foltan und Azar kehren im "Goldenen Eber" ein. Der Wirt Craupor schuldet Foltan einen großen Gefallen, weil Foltan ihn früher vor Banditen gerettet hat. Reisende und Spielleute feiern; das bevorstehende Verbannungsfest vergrößert den Verkehr. Foltan berichtet vom zerbrochenen Rat der Zehn, der Schlacht und den untätigen Fürsten. Er selbst ist desertiert; Azar hat sich nach hoher Verschuldung nach Norden abgesetzt. (S. 46 bis 53.)

Während Foltan den Wirt befragt, erzählt Azar den Grund der Desertion: Foltans Einheit sollte Bauern zur Herausgabe angeblich verborgener Steuern zwingen. Die Bauern hatten nichts. Der Hauptmann ließ Frauen und Kinder ermorden, obwohl Foltan sich weigerte. Foltan will nun Menschen schützen, denen er damals nicht helfen konnte. Nach seiner Rückkehr behauptet er, der Wirt habe keine Spur zu Kyra gefunden. Die drei verlassen die Taverne, da Foltan eine Übernachtung dort für unsicher hält. Diese Auskunft wird später als Lüge aufgedeckt. (S. 53 bis 54, 83 bis 88.)

### Kapitel 4: Versprechen und Gefangenschaft

Kyra erreicht ein Zeltlager an einem Weiher. Der narbige Entführer wird als Algard benannt. Der gebissene Mann lässt Kyra waschen und schminken, um seine Wette zu gewinnen. Sie wird vor den Hauptmann geführt: Baris ist riesenhaft, mit kurzgeschorenen schwarzen Haaren und buschigem Vollbart. Seine Rüstung ist fast doppelt so groß wie Kyra. Er lässt sich von ihrem Widerspruch unterhalten und behält sie als Dienerin. Orwen soll ihr die Arbeit zeigen. (S. 55 bis 59, 63 bis 64.)

Am eigenen Lagerfeuer zeigt Lia ihren beiden Begleitern, dass sie lesen kann. Weder Foltan noch Azar können es. Aus "Cronibus großes Kräuterlexikon" liest sie über Speikraut vor. Danach liest sie das Ende der Geschichte Alanas und Riccards. Die Männer streiten freundlich über den Wahrheitsgehalt solcher Abenteuer. Als Lia nach ihren verstorbenen Eltern fragt, reagieren sie fürsorglich. Azar und schließlich auch Foltan versprechen, ihr bei der Suche nach Kyra zu helfen. (S. 60 bis 62, 65 bis 67.)

Im Lager der Dunkelschatten wird getrunken, musiziert und ein erlegtes Wildschwein gegessen. Kyra bleibt abseits angekettet und hungrig. Orwen bringt ihr Reste und Metbier und befiehlt, Baris am Morgen Speck und Eier zu machen. Kyra beschließt, weiterzukämpfen und nicht aufzugeben. Sie ist eine eigene handelnde Figur, deren Geschichte nicht auf passives Warten reduziert werden sollte. (S. 67 bis 71.)

### Kapitel 5: Das private Ziel trifft auf den Krieg

Beim Frühstück hört Kyra Baris und Orwen über eine Karte und eine bisher nicht gefundene Grotte sprechen. Ein nicht namentlich genannter Meister besteht auf der Echtheit der Karte. Sie suchen ein Geweih. Baris will persönlich nachsehen und nimmt Orwen, drei weitere Männer und Kyra mit. Die Stelle liege zwei Tagesritte entfernt. Kyra kann reiten. Name, Identität und tatsächliche Macht des Meisters sind im Roman nicht geklärt. (S. 71 bis 75.)

Lia wäscht sich am Bach und versorgt die inzwischen heilende Ferse. Auf dem Weg ins geheime Lager muss sie eine Augenbinde tragen. Dort trifft sie Menschen, Elfen und Zwerge. Elnon, ein schwarzhaariger Elf, führt die Bruderschaft. Sein silberhaariger Begleiter mit großer Brandnarbe heißt Alastir. Das befestigte Lager besitzt Palisaden und Wachtürme. Menschen tragen Farben von Trapas, Zwerge Farben von Moneda, Elfen Farben von Ebaril. Elnon war Hauptmann der Garde von Ebaril, bevor die Dunkelschatten die Stadt niederbrannten. Azar erklärt, dass ein Schmied auch ohne große Kampfkraft unentbehrlich ist. (S. 75 bis 82.)

Lia sucht Elnon auf und hört vor dem Zelt eine Besprechung. Foltan weiß von dem fünfköpfigen Trupp mit einer Gefangenen. Er vermutet, dass diese Kyra ist. Zugleich habe der Trupp nach einem Geweih gesucht. Foltan hat Lia die Information verschwiegen, weil er ihre Schwester für kaum noch rettbar hält und die übergeordnete Mission nicht gefährden wollte. Elnon kritisiert sein Verhalten, versteht aber sein Abwägen zwischen Einzelschicksal und vielen bedrohten Menschen. Lia hört nur genug, um sich verraten zu fühlen, und verlässt die Umgebung des Zelts. (S. 82 bis 85.)

Foltan erzählt Azar später vom Geweih Regas, des Hirsches von Destar. Er selbst weiß wenig darüber; die Verbindung zu göttlicher Macht wird im Gespräch vermutet. Destar wird als Gott Elnons und Alastirs bezeichnet. Als Foltan außerdem zugibt, die Spur Kyras verheimlicht zu haben, reagiert Azar wütend. Für ihn gilt das Versprechen gegenüber Lia. Er geht sie suchen. Foltan zweifelt an seinem Verhalten. (S. 85 bis 88.)

### Kapitel 6: Unabgeschlossener Bruch

Lia irrt allein durch den nächtlichen Wald. Sie will ihren vermeintlich falschen Freunden nicht mehr vertrauen und Kyra allein suchen. Wind verdeckt die Sterne, dann beginnt ein starker Sommerregen. Im Lager meldet Azar, dass er sie nicht gefunden habe. Foltan versucht sich beruhigende Erklärungen zu geben, schämt sich inzwischen aber für seine Lüge. An dieser Stelle bricht der ausgearbeitete Text ab. (S. 89 bis 90.)

## Figuren und Beziehungen

| Name oder Bezeichnung | Beleg und Haltung | Bedeutung für die Adaption |
| --- | --- | --- |
| Lia | Lesende Bauerntochter, rotblonde Locken, Zwilling Kyras; sucht nach dem Überfall ihre Schwester. S. 7 bis 22. | Spielbare LIA; beginnt mit Wissen und Improvisation statt Kampferfahrung. |
| Kyra | Lange nussbraune Haare, braune Augen, beiges knöchellanges Kleid; arbeitet viel, liest kaum; widersetzt sich Entführern, kann reiten. S. 6 bis 12, 33 bis 45, 71 bis 75. | Persönlicher Kern der Hauptgeschichte; ihre Selbstbehauptung in Zwischensequenzen oder begrenzten Abschnitten erhalten. |
| Mutter der Schwestern | Wohlhabende Herkunft aus Trapas, entschied sich für das Bauernleben; lehrt Lesen und Schreiben, besitzt Wundtinktur. S. 11 bis 12, 19 bis 20. | Erklärt Lias Wissen und Fürsorge. Die Prologretterin ist nicht ausdrücklich als dieselbe Frau identifiziert. |
| Vater der Schwestern | Bauernhof, Markt in Trapas, Bücher und Gebäck als Geschenke, verstecktes Geld und Dolch; schützt Kyra mit einer Lüge. S. 11, 14 bis 19. | Familienerinnerungen und materieller Ausgangspunkt. Kein Name genannt. |
| Valentus | Grauhaariger Magier in blau-weißer Robe, gejagt und tödlich erkrankt; erlebt Schlacht im Fiebertraum; verschwindet nach magischem Vorgang an einem Säugling. S. 1 bis 6. | Intro und langfristiges Geheimnis; gewähltes Kind und Art der Übertragung offenlassen. |
| Foltan | Ehemaliger Leutnant aus Portas; braunes Haar, Ziegenbart, ledernes Barett, blau-gelber Waffenrock, Armbrust und Schwert. Desertierte aus moralischem Widerspruch, ist pragmatisch und verheimlicht später die Spur. S. 25 bis 31, 53 bis 54, 83 bis 90. | Mentor mit eigenem Konflikt. Sein Wortbruch verlangt eine Konsequenz, nicht nur einen beiläufigen Dialog. |
| Azar | Schmied aus Ignis; korpulent, kurzer schwarzer Bart, rote Haube, gelbes Gewand und gekrümmtes Schwert; verschuldet, gutmütig und redselig. S. 26 bis 29, 53, 66 bis 67, 81 bis 82, 87 bis 89. | Verlässlicherer Gefährte, Ausrüstung und Lagerhandwerk. Seine Kompetenz wird nicht nur über Kampf bewertet. |
| Elnon | Muskulöser Elf, lange schwarze Haare im Zopf, bestickte grüne Tunika, Axt; gewählter Anführer, früher Gardehauptmann von Ebaril. S. 78 bis 85. | Strategische Führung und Konflikt zwischen konkreter Rettung und gemeinsamer Sicherheit. |
| Alastir | Elf mit langem silbernem Haar, halber Gesichtshälfte als Brandnarbe, braunem Cape und grüner Tunika; empört über Entweihung des Geweihs. S. 78 bis 79, 83 bis 86. | Wissensgeber über Ebaril und Destar; genaue Funktion in der Führung nicht benannt. |
| Orwen | Grauhaariger Täter mit dunklem Mantel, Goldbrosche und Schwert, rechte Hand Baris'; tötet die Eltern und bringt Kyra ins Lager. S. 13 bis 16, 45, 63 bis 74. | Persönlicher Antagonist und organisatorische Schnittstelle des Gegnertrupps. |
| Baris | Riesiger Hauptmann, schwarzes Haar und Vollbart; misshandelt Dienerinnen, sucht im Auftrag eines Meisters ein Geweih. S. 59, 63 bis 64, 72 bis 75. | Lokaler Hauptgegner. Von den beiden überlebenden Zaubermeistern zu unterscheiden. |
| Algard | Narbiger Dunkelschatten, Spötter und Trinker. S. 14, 56, 68 bis 69. | Identifizierbarer Gegner im Lager, keine zusätzliche Herkunft belegt. |
| "Mädchen" | Kahlgeschorener Entführer; Spitzname nach Kyras Biss, brutal und auf die eigene Wette bedacht. S. 33 bis 35, 44 bis 45, 56 bis 59. | Gegnername als Spitzname behandeln; bürgerlicher Name fehlt. |
| Craupor | Dürrer, glatzköpfiger Wirt des Goldenen Ebers, früher von Foltan vor Banditen gerettet; liefert Spur. S. 47 bis 54, 87. | Informationsdrehscheibe und glaubhafte Taverne. Einmal steht die Variante "Caupor". |
| Drei namenlose Zwerge | Spielen in der Taverne, bewaffnet und geflochtene Bärte; einer verweigert Kyra die Hilfe. S. 36 bis 37. | Gesellschaftliche Erwartungen können scheitern. Keine pauschale Aussage über alle Zwerge. |
| Schankfrauen, Händler, Handwerker, Gaukler | Haben Angst vor Dunkelschatten; reisen wegen Handel und Fest. S. 23, 35, 47 bis 49. | Bevölkerung mit eigenem Alltag, ein glaubhafter Ausgangspunkt für optionale Begegnungen. |

Die Beziehung Lia und Kyra hat zwei Seiten: Streit über Arbeit und Lesen sowie tiefe Bindung nach dem Verlust. Foltan und Azar ergänzen sich durch militärische Erfahrung und handwerkliche Kompetenz. Bei beiden wird die Sicht auf das junge Mädchen durch ihr Lesen und ihre Offenheit verändert. Der spätere Streit ist eine Probe dieses gewachsenen Vertrauens. Elnon und Foltan stehen für die Sicherheit einer Gruppe; Azar hält an einer konkret gegebenen Zusage fest. Keiner dieser Konflikte sollte ohne Handlungsspielraum einfach als allgemeines Gut oder Böse dargestellt werden.

## Welt, Orte und Kräfte

### Geografie

| Ort | Gesicherte Information | Möglicher Spieleinsatz, als Entwurf |
| --- | --- | --- |
| Selantis | Name der Welt beziehungsweise des Landes; Reise nach Portas führt laut Lia quer über einen Kontinent. S. 5, 22 bis 23. | Offene Welt aus zusammenhängenden Regionen. Eine vollständige Landkarte müsste erstellt werden. |
| Familienhof | Bauernhaus, größere Scheune rechts, Schweinegatter hinter dem Haus, kleines Wäldchen, Obstbäume, Felder und Hohlweg. S. 7 bis 13. | Ruhiges Tutorial und wiederkehrender Erinnerungsort. |
| Trapas | Stadt westlich der Weggabelung; stark garnisoniert, Markt, Händlerfamilie der Mutter, Lichterorden und Verbannungsfest. S. 11, 22 bis 23, 30, 47 bis 48. | Größerer Ort für Handel, Religion und politische Spannung. |
| Portas | Florierende Handelsstadt im Osten, Wochenreise entfernt, eigene Stadtgarde und "Falken". S. 3, 22 bis 23, 28, 49, 53 bis 54. | Spätere Stadtregion, Foltans Vergangenheit und Steuerkonflikte. |
| Ebaril | Heimatstadt der Elfen, als einst prächtig beschrieben; von Dunkelschatten niedergebrannt. S. 3, 80 bis 81. | Ruinenregion und persönliche Geschichten Überlebender. Das genaue Stadtbild ist nicht beschrieben. |
| Moneda | Zwerge im Lager tragen dessen Farben. S. 80. | Möglicher späterer Bezug; Lage, Architektur und politischer Status fehlen. |
| Ignis | Herkunft Azars als Schmied. S. 28. | Möglicher Handwerks- oder Schuldenstrang; mehr ist nicht belegt. |
| Imandur | Alana und Riccard forschten an der dortigen Magierakademie in Dämonologie. S. 65. | Wissens- und Magieort, sofern im späteren Spiel benötigt. Heutiger Zustand unbekannt. |
| Dunkelhain | Schauplatz der großen Schlacht 14 Jahre vor Kapitel 1, zugleich zeitlicher Bezug der Buchgeschichte. S. 9, 13, 65. | Historischer Schlüsselort; konkretes Gelände nicht festgelegt. |
| Goldener Eber | Gasthaus an der Handelsroute, Eberschild, rechts Theke, links Tische, zentraler Holzpfeiler, Stall; beide Handlungsstränge führen hier durch. S. 34 bis 40, 46 bis 54. | Glaubhafte Wegkreuzung für Haupthinweise und freiwillige Gespräche. |
| Bruderschaftslager | Geheimer Standort im Wald, Zelte, Feuerstellen, Palisade und Wachtürme, Kampftraining und Handwerk. S. 77 bis 85. | Erster Hub für Training, Fähigkeiten und Ausrüstung. |
| Lager Baris' | Lichtung an kleinem Weiher, Zelte, Wache, Feuerstelle, großes schwarzes Hauptmannszelt mit Baldachin. S. 56 bis 59. | Aufklärungs- und Rettungsgebiet. |
| Gesuchte Grotte | Auf Karte bezeichnet, Späher finden sie nicht; von Baris' Lager zwei Tagesritte entfernt. S. 72 bis 74. | Rätsel und späterer Hauptquestort; tatsächliche Existenz hier unbestätigt. |

Die relativen Richtungen Trapas im Westen und Portas im Osten sind belegt. Detaillierte Distanzen, Küsten, Gebirgszüge, regionale Grenzen und die Lage des Bruderschaftslagers sind nicht festgelegt. Die geringe Entfernung zwischen den zeitlich versetzten Besuchen beider Gruppen im Goldenen Eber darf nicht als vollständige Weltkarte gelesen werden.

### Politik und Krieg

Vor der großen Schlacht bestand der Rat der Zehn aus Zaubermeistern und stand über den Fürsten. Sechs wollten die bestehende Ordnung bewahren, vier waren abtrünnig. Die Fürsten unterstützten die sechs; auf der Gegenseite standen Räuber, Söldner und bewaffnete Bauern, aus denen die Dunkelschatten hervorgingen. Nur zwei abtrünnige Zaubermeister überlebten. Der Rat zerbrach. Seitdem ziehen Dunkelschatten weitgehend ungehindert durchs Land, während Fürsten sich in ihre Städte zurückziehen, eigene Interessen verfolgen oder einander bekämpfen. Diese Darstellung stammt überwiegend aus Foltans Erzählung und trägt seine politische Haltung. Sie ist nicht als allwissende, unparteiische Geschichtsschreibung präsentiert. (S. 9, 13 bis 14, 51 bis 52.)

Der Rat der Drei wird separat erwähnt. Sein Großmeister führe einen Feldzug gegen fremde Kulte und vernachlässige Schutzaufgaben. Der Text beschreibt dies als Gerücht und erklärt weder die genaue Zusammensetzung des Rats noch sein Verhältnis zu den übrigen Regenten. Lichterorden, Paladine des Lichts und Rat der Drei dürfen deshalb nicht ohne zusätzliche Quellen zu einer einzigen vollständig definierten Organisation zusammengezogen werden. (S. 3, 30.)

Die Freie Bruderschaft ist eine Gemeinschaft von Freischärlern, Deserteuren und Menschen ohne bessere Alternative. Sie verfolgt Dunkelschatten und will Schutzlose unterstützen. Menschen, Elfen und Zwerge arbeiten zusammen. Der Anführer ist gewählt. Ihr Idealkodex verhindert nicht Pragmatismus, Misstrauen und Streit darüber, wem tatsächlich geholfen werden kann. (S. 29, 43, 51 bis 53, 77 bis 88.)

### Religion, Mythen und Magie

Die Zehn Götter besiegten laut der geschilderten Religion ihre Schöpferin Xenovia und verbannten sie in die Tiefen der Meere. Das Verbannungsfest erinnert jährlich im Sommer daran. Kettenförmiges Hefegebäck erinnert an die zerbrochene Knechtschaft; man soll dankbar sein, sich beschenken und das Leben feiern. Foltan kritisiert die stärkere Betonung von Essen und Trinken statt Tempelfeier. Die Quelle zeigt also sowohl religiöse Überzeugung als auch kulturelle Festpraxis. (S. 47 bis 48.)

Crios ist ein heller westlicher Stern, benannt nach dem Adler des ersten Menschen Aros. In Lias gelesener Überlieferung hilft Crios Aros beim Sturz Xenovias. Elnon und Alastir verehren Destar; dessen Hirsch heißt Rega, erschlossen aus der Form "Geweih Regas". Das Geweih hat für sie offenbar religiöse Bedeutung, aber die Szene belegt keine bestimmte Zauberwirkung. Der Rat der Zehn Zaubermeister und die Zehn Götter sind getrennte Begriffe. (S. 32, 40, 86.)

Valentus' Energiestrahl, Druckwelle und magischer Schimmer sind unmittelbar erzählt, allerdings teilweise im Fiebertraum. Alana und Riccard gelten Foltan zufolge als reale historische Zauberer, ihre im Buch beschriebenen Abenteuer bezweifelt er. Das vorgelesene Ende berichtet von Dämonen, der Akademie in Imandur und ihrer Berufung in den Rat nach dem Tod Jaromirs und Irinas, im Jahr 256 vor Dunkelhain. Balduin wird früher als fahrender Ritter und Alanas Liebe erwähnt; die Quelle erklärt seine Beziehung zu Riccard nicht. Das ist kein Beleg für einen absichtlichen Widerspruch. (S. 3 bis 6, 11, 65 bis 66.)

In den 90 Seiten zaubert Lia selbst nicht. Es gibt keine belegten Regeln zu Mana, Elementschulen, Zauberkosten, Fertigkeitsstufen, Wiederbelebung, Teleportationspunkten oder vererbter Magie. Ein Fertigkeitsbaum ist ein vom Nutzer gewünschtes Spielsystem, dessen konkrete Regeln zu entwerfen sind.

## Material für optionale NPC-Begegnungen und Nebenquests

Die folgenden Ansätze sind Spielentwürfe. Die jeweils genannte Beobachtung ist belegt; Auftrag, Belohnung, neue Figuren und Ausgang sind neu. Optionale Inhalte sollten Lias Hauptziel respektieren: Die dringende Suche nach Kyra darf nicht durch lange sachfremde Pflichtarbeiten blockiert werden.

| Beobachtung in der Quelle | Optionaler Ansatz | Passender Fortschritt |
| --- | --- | --- |
| Lia nimmt Kräuterlexikon und Wundtinktur mit, versorgt sich selbst. S. 19 bis 21, 62, 75 bis 76. | Eine verletzte Reisende am Bach helfen; passende Pflanze anhand des Buchs identifizieren. Kein realmedizinisches Wissen als Anleitung ausgeben. | Erfahrung für Beobachtung und Kräuterkunde, Material oder Rezept im Spiel. |
| Das Geheimfach enthält Münzen und einen Familientolch. S. 19. | Früh eine gefundene Börse zurückbringen oder behalten; später ihre Herkunft im Gespräch klären. | Erfahrung und Vertrauen, geringe Ausrüstungswirkung. |
| Gaukler und Spielleute reisen zum Verbannungsfest. S. 23, 47 bis 48. | Ein verlorenes Instrument suchen, eine blockierte Passage freimachen oder eine örtliche Geschichte hören. | Erkundungserfahrung, Gerücht, Abkürzung, Musik am Hub. |
| Craupor wurde früher von Foltan gerettet; die Taverne dient als Umschlagplatz von Nachrichten. S. 49, 53, 87. | Einen alten Zeugen finden oder einem Reisenden helfen, dessen Bericht eine alternative Spur zu Kyra enthält. | Hauptweg kann klar bleiben, Zusatzinformation verbessert Vorbereitung. |
| Drei Zwerge streiten über Spielregeln und verweigern Kyra Hilfe. S. 36 bis 37. | Ein optionales Tischspiel oder später ein Gespräch mit einem beschämten Zeugen. Eine Wiedergutmachung wäre neue Handlung. | Kleine Erfahrung, Bekanntschaft oder Handelszugang. |
| Foltan und Azar können nicht lesen. S. 61 bis 62. | Briefe, Verträge und alte Aufzeichnungen freiwillig vorlesen; Azars Schuldenverständnis vertiefen. | Lesen als nützliche Anfangskompetenz, Dialogwissen und Vertrauen. |
| Azar repariert Kettenpanzer, schärft Schwerter und richtet Helme. S. 82. | Auf Materialsuche gehen oder eine verschwundene Lieferung finden. | Ausrüstungsverbesserung, Erfahrung für Handwerk und Erkundung. |
| Überlebende Elfen dienen nach der Zerstörung Ebarils in der Bruderschaft. S. 81. | Erinnerungsgegenstand bergen, Angehörige suchen, Überlebende begleiten. | Vertrauen bei Elfen, Wissen über Region und Destar. |
| Kampftraining findet an der Palisade statt. S. 81. | Sich freiwillig im Ausweichen, Dolchgebrauch oder der Beobachtung von Gegnern unterweisen lassen. | Freigeschaltete Grundfertigkeit; Übungen sind ein Spielentwurf. |
| Hoffeste, Honiggebäck, Obstbäume und kleine Familienrituale geben dem Alltag Farbe. S. 8, 11, 48. | Beim Fest eine kurze persönliche Begegnung, eine Rezeptgeschichte oder eine Erinnerung an die Mutter finden. | Ein emotionaler Moment und geringfügiger Fortschritt statt Pflichtsammeln. |
| Menschen fürchten Räuber auf den Handelswegen. S. 22 bis 23, 35, 51 bis 52. | Einen verletzten Händler geleiten, Furt prüfen oder einen versteckten Weg entdecken. | Erfahrung auch für friedliche Lösungen und Aufklärung. |

Die Quelle legt keine neuen NPC-Namen für diese Entwürfe fest. Neue Namen sollten mit dem Figurenregister abgestimmt werden. Ein dynamisches Lager ist besonders anschlussfähig: Andere Mitglieder kochen, üben, reparieren, bewachen und erzählen, während Lia ihren Hauptweg verfolgen kann.

## Vorschlag für Spielstruktur und Fortschritt

Dieser Abschnitt ist eine Adaption, kein Bericht über vorhandene Romanhandlung.

1. **Intro als Zwischensequenz:** Die nächtliche Flucht Valentus', Versorgung und Szene an der Wiege werden knapp erzählt. Die Identität des ausgewählten Kindes bleibt zunächst offen. Eine kurze Schlachtimpression kann seine Erinnerung darstellen. Das Spiel darf nicht behaupten, Lia habe diese Erinnerung selbst bereits verstanden.
2. **Hof als kurzer spielbarer Alltag:** Lesen, die Begegnung mit Kyra, ein kleiner freiwilliger Handgriff und der Heimweg vermitteln Steuerung und Bindung. Der Überfall ist der Auslöser. Danach werden Bestattung und Reisevorbereitung mit zurückhaltenden Interaktionen verbunden.
3. **Die offene Welt beginnt an der Hauptstraße:** Der östliche Weg ist das klare Hauptziel. Seitenpfade, Bach, Händler, Gaukler und Taverne bieten freiwillige Begegnungen, ohne die Rettung vom Abschluss sämtlicher Nebenaufträge abhängig zu machen.
4. **Foltan und Azar als erste Gefährten:** Kurze gemeinschaftliche Abschnitte vermitteln Sicherheit, Wissen und deren Grenzen. Ihre Verbindung wächst über Gespräche und Lesen, nicht ausschließlich über Kämpfe.
5. **Die Bruderschaft als erster Hub:** Training, Handwerk und freiwillige Hilfe machen neue Möglichkeiten zugänglich. Die Suche nach Kyra und die Suche der Gegner nach dem Geweih laufen aufeinander zu. Der Konflikt um Foltans Lüge eröffnet ein eigenes Urteil Lias.
6. **Spätere Hauptgeschichte nach Quellenabgleich:** Kyras Rettung, Geweih, Magie und weitere Reise werden anhand der Filme geplant. Für einen frei gewählten spielerischen Weg können unterschiedliche Lösungen zum belegten Hauptereignis führen. Eine noch unbelegte Rettung darf nicht als Romanende bezeichnet werden.

Erfahrungspunkte können für Entdeckungen, gelöste Begegnungen, Hilfe, gelesene Zusammenhänge und Hauptereignisse vergeben werden. Ein Levelaufstieg erlaubt dem Nutzerwunsch entsprechend die Verteilung von Fertigkeitspunkten. Die ersten Kategorien können Beobachtung, Überleben, Kräuterkunde, Geschick und Gespräch sein. Kampftraining wird gelernt; Magie wird erst nach einem belegten oder ausdrücklich adaptierten Auslöser freigeschaltet. Die Quelle selbst liefert keine Kategorien oder Zahlenbalance.

Lesen sollte als vorhandene Fähigkeit Lias bestehen bleiben, während höhere Stufen komplexere Texte erschließen oder die Qualität von Schlussfolgerungen verändern können. Sonst würde ein Fortschrittssystem ihre belegte Ausgangskompetenz entfernen. Ebenso darf ein Fertigkeitswert kein garantiertes moralisches Urteil über Personen liefern. Die uneindeutigen Motive Foltans, Elnons und der Tavernegäste tragen gerade durch ihre Ambivalenz.

## Canonical spelling und offene Punkte

Für die Adaption verbindlich durch Nutzerangabe: **LIA** als Anzeigename. Romanname: **Lia**. Weitere stabile Schreibweisen: **Kyra, Valentus, Foltan, Azar, Elnon, Alastir, Orwen, Baris, Algard, Selantis, Trapas, Portas, Ebaril, Moneda, Ignis, Imandur, Dunkelhain, Dunkelschatten, Freie Bruderschaft, Xenovia, Aros, Crios, Destar, Alana, Riccard, Balduin, Jaromir, Irina**.

| Punkt | Quellenlage | Arbeitsregel |
| --- | --- | --- |
| Craupor / Caupor | "Caupors" einmal S. 47, danach wiederholt Craupor. | Craupor als häufigere Romanform, Variante im Register festhalten. |
| Rega / Regas | Nur possessive Form "Geweih Regas" auf S. 86. | Rega als erschlossene Grundform kenntlich machen, Filmabgleich abwarten. |
| Alanas Buch | "Die Geschichten der Magierin Alana" auf S. 11, 21; Singular "Die Geschichte" auf S. 62. | Plural als überwiegenden Buchtitel nutzen, kleine Manuskriptvariante festhalten. |
| Cronibus | "Cronibus großes Kräuterlexikon" auf S. 21 und 62. | Schreibweise bewahren; Person oder Titelrolle nicht weiter definieren. |
| Lias Alter | 14 Jahre seit Schlacht, aber keine Alterszahl für Lia. | Keine exakte Zahl als belegt ausgeben. |
| Grüner Blick | Grüne Augen der Prologretterin S. 2. | Keine automatische Vererbung an Lia. |
| Säuglinge | Zwei Kinder, eines wird gewählt; Namen fehlen. S. 5 bis 6. | Magieherkunft als Geheimnis und naheliegende Verbindung behandeln. |
| Tod Valentus' | Er glaubt nicht genesen zu können, verschwindet nach Licht und Knall. S. 5 bis 6. | Den sichtbaren Vorgang erzählen, Tod oder Transformation nicht als gesichert hinzufügen. |
| Dunkelschattenzahl | Erst vier draußen, ein fünfter kommt aus dem Haus. S. 13 bis 14; später fünf. | Kein Widerspruch, fünf Entführer. |
| Baris und Zaubermeister | Baris dient einem Meister; zwei abtrünnige Zaubermeister überlebten. S. 52, 73. | Die Identität des Meisters nicht ohne Quelle zuordnen. |
| Geweihfunktion | Beteiligte vermuten göttliche Macht; genaue Wirkung unklar. S. 86. | Keine feste Fähigkeit, Farbe oder Artefaktregel erfinden und als Quelle ausgeben. |
| Zeitrechnung | Geschichte 256 vor Dunkelhain; aktuelle Handlung 14 Jahre nach Schlacht. S. 9, 65. | Datum als Quellenangabe festhalten, keinen vollständigen Kalender behaupten. |

## Vergleich mit den drei Filmen

Die geprüften Arbeitsberichte [Folge 1](episode-01.md), [Folge 2](episode-02.md) und [Folge 3](episode-03.md) wurden für den Abgleich gelesen. Die Zeitangaben unten verweisen auf die darin geprüften Szenen. Dieser Romanvergleich behauptet keine zusätzliche lückenlose Filmprüfung. Für jeden Punkt werden Romaninformation, Filmbeleg, Nutzerentscheidung und neuer Spieleentwurf getrennt angegeben. Im durch den Roman abgedeckten Abschnitt entscheidet gemäß Nutzeranweisung die Romanversion.

Die Unterschiede sind größer als eine Umbenennung der Hauptfigur. Besonders die Reihenfolge von Rettung, Magie und Bruderschaft ist verändert. Foltan und Azar können deshalb nicht stillschweigend durch Flick ersetzt werden. Die beiden Fassungen liefern Material für eine gemeinsame Adaption, keine bereits identische Handlung.

| Punkt | Roman | Filmberichte | Entscheidung für das Spiel |
| --- | --- | --- | --- |
| Hauptfigur | Lia, rotblonde Locken, weißes Hemd und brauner Rock. S. 8 bis 9, 19. | Triss, braunes bis dunkelblondes Haar, weißes Hemd und senfgelber Rock. Folge 1, 06:22 und 12:22. | LIA und Romanreferenz gelten für den Anfang. Spätere Kostümwechsel können als Entwicklung entworfen werden. |
| Die lesende Schwester | Lia liest, Kyra trägt den größeren Teil der Arbeit und hat Lesenlernen aufgegeben. S. 7 bis 12. | Die in den Rollenberichten als Kyra identifizierte Frau im beigefarbenen Kleid liest in der Feldszene. Folge 1, 04:07. | Romanbeziehung übernehmen; die Buchleserin des Films ist keine visuelle Vorlage für Lias Rolle. |
| Elternhaus und Überfall | Hof mit Bauernhaus, Scheune, Schweinen und Hohlweg; Steingräber nach dem Überfall. S. 13 bis 22. | Überfall und tote Eltern an einer Ruinenmauer, anschließend Waldflucht. Folge 1, 06:28 bis 09:10. | Den Hof und Lias Reisevorbereitung erhalten. Ruinen können später als eigener Ort dienen. |
| Erste Gefährten | Foltan und Azar finden Lia im Wald; sie gehen gemeinsam in die Bruderschaft. S. 25 bis 32, 77 bis 82. | Flick hilft Triss bei der Verfolgung und Rettung. Folge 1, 09:20 bis 18:22. | Foltan und Azar bleiben früh. Eine spätere Begegnung mit Flick nach Manuskriptende wäre eine neue Übergangsszene. |
| Hauptmann und Täter | Orwen tötet die Eltern; Baris nimmt Kyra als Dienerin und zieht zur gesuchten Grotte. S. 15 bis 16, 45, 64, 72 bis 75. | Vardis ist der Hauptmann in Folge 1; Baris ist der benannte Hauptmann in Folge 2. | Keine unbelegte Identität Vardis = Baris = Orwen. Eine Zusammenführung wäre offen als Adaption zu beschreiben. |
| Grund der Entführung | Kyra soll Baris gefallen und arbeiten; die Entführer suchen mehrere Höfe nach einer passenden Dienerin ab. S. 15, 38 bis 39. | Kyra wird als vermeintliche Machtträgerin mitgenommen; der Meister erklärt Vardis, er habe die falsche Person. Folge 1, 19:20. | Die Dienerinnenentführung gilt am Anfang. Ein später erkanntes Verwechslungsmotiv braucht eine neu entworfene Verbindung. |
| Ankunft in der Bruderschaft | Kyra gefangen, Lia ohne eigene Magie; Elnon kennt Geweihspur, Foltan verschweigt Spur. S. 77 bis 88. | Kyra bereits befreit, Triss hat Magie ausgelöst, Flick begleitet beide. Folge 1, 19:44; Folge 2, 03:17 bis 09:05. | Romanreihenfolge behalten. Filmprüfung und Lagerangriff können später in veränderter Anordnung eingesetzt werden. |
| Anführername | Elnon. S. 79, 81, 84 bis 85. | Elhon, durch Rollenabspann in Folge 2 bestätigt. | Elnon im Spielanfang. Eine spätere Gleichsetzung benötigt dokumentierte Adaptionsentscheidung. |
| Magieübertragung | Valentus wählt einen von zwei Säuglingen, Magie und Verschwinden werden gezeigt; Art und Kind unbenannt. S. 5 bis 6. | Urmacht, Triss als Kind und Valentus' Tod werden im Filmbericht aus Prolog beziehungsweise Ignatius' späterer Erklärung benannt. Folge 1, 00:10 bis 02:20; Folge 2, 16:19 bis 18:37. | Das Intro folgt der offen gehaltenen Romanszene. Die spätere Erklärung darf im Fortsetzungsbogen enthüllen, was Lia trägt. |
| Erstes Zaubern | Lia zaubert bis Manuskriptende nicht. | Unbewusster Ausbruch bei der Rettung, Erschöpfung danach. Folge 1, 17:50 bis 18:22. | Die Szene kann als späterer Wendepunkt adaptiert werden, nicht vor den Romanereignissen im Lager. |
| Religion und Herkunft | Xenovia, Zehn Götter, Aros/Crios und Destar werden aus Überlieferung und Gesprächen bekannt. S. 32, 47 bis 48, 86. | Ignatius erläutert erste zehn Menschen, Vergöttlichung und Bewachung der Urmacht. Folge 2, 16:19 bis 18:37. | Der Film kann spätere Erklärungen beitragen. Zehn Götter, zehn ursprüngliche Menschen und Rat nicht als drei beliebig austauschbare Namen behandeln. |
| Geweih | Regas Geweih wird gesucht, Grotte unbestätigt und Macht vermutet. S. 72 bis 74, 83 bis 86. | Folge 3 berichtet von zehn unbenannten Relikten der ersten Menschen für Vamirs Ritual. 37:15 bis 40:39. | Regas Geweih als eines dieser Relikte zu bestimmen ist ein Entwurf; die Filmberichte belegen das nicht. |

### Was die späteren Filmereignisse für die Fortsetzung tragen

Folge 2 bietet nach einer nötigen Übergangsadaption einen Lern- und Gefangenschaftsbogen: Die verborgene Kraft wird erkannt, ein Angriff trennt Freunde, Ignatius von Ignis schützt und unterrichtet die Heldin, Vamir verfolgt sie und beeinflusst Kyra. Der Stab Schattentöter wird als Lehrgerät benannt. Flicks halbelfische Herkunft und ihre Ausgrenzung liefern eine eigenständige Beziehungsgeschichte. Die Filmberichte geben keine fertige Zahlenbalance für Magie und keinen Nachweis frei verfügbarer Heilung oder Teleportation. (Folge 2, 06:53 bis 10:25, 10:58 bis 18:37, 25:49 bis 29:58, 32:20 bis 38:08.)

Folge 3 bietet einen Abschlussbogen: Valentus unterstützt die eigene Handlungsfähigkeit, Paladine und Großmeister behandeln die Heldin zunächst als Machtmittel, die kontrollierte Kyra führt sie in eine Falle, Verbündete unterbrechen das Reliktritual, Kyra wird wieder sie selbst, Vamir wird besiegt, Ignatius stirbt nach einer Aussöhnung, der Orden erkennt die Heldin als Hüterin der Urmacht an. Diese Ereignisse können einen späteren Spielabschluss tragen. Sie sind keine Ergänzung des bereits vorliegenden Romanmanuskripts. (Folge 3, 00:21 bis 05:35, 11:49 bis 20:01, 26:15 bis 30:22, 37:15 bis 46:59.)

Kyras Kontrolle darf dabei nicht in eine freiwillige, habgierige Abkehr von Lia verwandelt und dann als Filmbeleg ausgegeben werden. Die Urmacht verhindert im Film nicht jede Gefangennahme, Erschöpfung oder Giftwirkung. Ein Ende mit Lias Verantwortung und erneuerter Geschwisterbindung passt zum Filmabschluss; die politische Befriedung ganz Selantis ist durch die geprüften Szenen nicht vollständig nachgewiesen.

### Exakter Übergang zur Filmfortsetzung

Die ausgearbeitete Romanhandlung endet nicht schon mit Kapitel 5 oder mit Lias Entdeckung der Lüge. Sie reicht durch den Anfang von Kapitel 6 bis in den Regen: Lia ist aus dem Lager fort, allein im nächtlichen Wald und durchnässt. Azar meldet im Lager, dass er sie nirgends gefunden habe. Foltan hat sich seine Scham über die Lüge eingestanden. Das sind die letzten fertig erzählten Zustände auf S. 89 bis 90. Die zwei nachfolgenden kurzen Zeilen sind Arbeitsnotizen und keine zusätzlichen Szenen.

Ein Filmabschnitt, der eine frühere Waldflucht zeigt, ist deshalb nicht automatisch der richtige Anschluss. Für den Handoff müssen mindestens folgende Zustände zusammenpassen: Kyra lebt nach dem zuletzt gezeigten Romanstand und soll mit Baris' Trupp zur Grotte reiten; die Freie Bruderschaft weiß vom Geweih; Lia weiß von Foltans verschwiegenem Wissen und ist fort; Azar sucht sie; Foltan ist im Lager. Eine spätere Begegnung, magische Entdeckung oder Rettung kann erst als Fortsetzung eingesetzt werden, nachdem ihre Ursache und zeitliche Lage im Film geprüft sind. Falls die Filme diese Zustände in anderer Reihenfolge verbinden, braucht das Spiel eine offen bezeichnete Übergangsszene.

Der tatsächliche Abgleich zeigt eine solche andere Reihenfolge. Es gibt keinen belegten Film-Timecode, der alle fünf Romanendzustände unmittelbar fortsetzt. Ein möglicher neuer Anschluss wäre: Lia im Regen trifft eine neue Fährtenkundige, Flick; Azar bleibt auf ihrer Spur; Baris' Reise zur Grotte führt Rettungs- und Geweihstrang zusammen; dabei tritt der spätere filmgestützte Magieausbruch ein. Begegnung, Wegverknüpfung und genaue Rettung wären neu zu schreiben. Das ist ein konkreter Adaptionsansatz, keine aus beiden Quellen bereits hervorgehende Szene. Für eine Wiederaufnahme der Bruderschaft nach der Rettung müssten insbesondere Foltans Verantwortung und Lias Umgang mit dem Wortbruch ausgearbeitet werden.

Die Rettung Kyras und Lias endgültige Rolle im Kampf um Selantis sind somit Ziele für die vollständige Spielhandlung, keine bereits eingelösten Romanereignisse. Die Analyse bleibt auch bei einem vollständigen Filmabschluss klar über diese Grenze.

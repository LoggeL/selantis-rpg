# Selantis Teil zwei für Opus

Implementiere "Letzte Hoffnung" als vollständige spielbare Fortsetzung des bestehenden ersten Buchs. Die Gruppe sucht die Rebellen, gerät in eine gefährliche Machtprüfung und wird beim Angriff getrennt. Lia lernt bei Ignatius, während Vamir die Gefangenen bedroht. Der Teil endet mit Flicks Flucht, Kyras Kontrolle und Lias Aufbruch. Die Wiedervereinigung und Vamirs Niederlage gehören zu Teil drei.

## Material und Lesereihenfolge

1. [Opus Prompt](opus-prompt.txt), [Szenenplan](story-plan.md) und [Übergabevertrag](../transition-contract.md).
2. `AGENTS.md`, aktuelle `docs/rebuild/DESIGN.md`, `README.md` und [technische Anleitung](../technical-guide.md).
3. `docs/episode-02.md` vollständig; anschließend das vollständige `sources/transcripts/02-XUZV9T7fEsE.txt`. Die JSON-Datei enthält die Zeitsegmente. Namen und Sprecher in der automatischen Erkennung sind unsicher.
4. Romananalyse und Romanvolltext als Grundlage für Lia, Kyra, Foltan, Azar und Elnon; Mythologietext für die Welt. Danach den aktuellen Schluss in `game/src/chapters/kapitel-5/` lesen.
5. Originalfilm, Kontaktbögen und Schlüsselbilder für Ablauf und Inszenierung. Bildvorlagen für neue Spielfiguren kommen aus den freigegebenen Referenzbögen und eigenen Entwürfen.

Die genaue Dateiliste steht in [Materialien](materials.md). Das ZIP enthält die vorbereiteten Handoffs, den Quellstand, Bilder, Transkripte, Roman, Mythologie, Stilreferenzen und die verfügbaren Originalmedien. Sein `SNAPSHOT.json` dokumentiert Commit, lokale Änderungen und die Prüfung der Ausgangslage; `FILES.json` enthält Größen und SHA-256-Werte. Der Repository-Quellstand befindet sich im Paket unter `project/`.

## Erzählerische Vorgaben

Lia bleibt Lia, Film-Triss ist dieselbe Adaptionsrolle. Die aktuelle Design-Bibel verwendet Elnon für den Anführer; der Film nennt ihn Elhon. Keine zusätzliche Figur allein aus dieser Namensabweichung erzeugen. Baris ist der Hauptmann, Orwen dessen rechte Hand. Vardis ist ein Transkriptfehler. In Teil eins kennt Lia den Meister noch nicht als Vamir; die Erklärung in Teil zwei führt dieses Wissen ein.

Die Rückkehr zu Elnons Bruderschaft muss Lias Erfahrungen mit Foltan und Azar berücksichtigen. Eine Begegnung, Antwort oder kurze Brücke darf den bestehenden Vertrauensbruch aufgreifen. Eine vollständige Versöhnung oder Rückkehr der beiden als dauerhafte Gruppenmitglieder ist nicht vorgegeben. Der Auftrag braucht dafür kein neu erfundenes Nebenabenteuer.

Flicks Ausgrenzung, Lias Schuldgefühle und Kyras Loyalität tragen die Trennung. Die Dialoge werden auf Deutsch neu und figurspezifisch geschrieben. Die Filme liefern Ereignisse und Konflikte; ihr Wortlaut ist kein Dialogskript für das Spiel. Folter und Kontrolle werden mit Kamera, Posen, Licht und Folgen inszeniert. Daraus werden keine zusätzlichen dauerhaften Verstümmelungen oder frei gewählten Verratsmotive abgeleitet.

Lias Training darf den optional schon erlernten Lichtstoß nicht löschen. Die Urmacht bleibt begrenzt und erschöpfend. Ignatius' Bericht unterscheidet Wissen, Deutung und Visionen. Unsichere Begriffe wie der Prüfungsname, Druidenname und mythologische Eigennamen werden an den angegebenen Stellen nachgehört oder neutral umschrieben. Konkrete offene Entscheidungen stehen im Szenenplan.

## Umsetzung

Eigener Ordner `game/src/chapters/teil-2/`, Kapitel-ID `teil-2`, neue IDs mit `e2-`. Die vorgeschlagenen Szenen im Szenenplan enthalten jeweils ein spielerisches Herzstück. Erkundung, Gespräche, begrenztes Training, sichere Schleichabschnitte und Gefangenenperspektiven nutzen die vorhandenen Engines. Große Ereignisse werden im Spiel inszeniert; optionale Aufträge bleiben kurz und müssen die Hauptgeschichte unterstützen.

Für jede neue Szene: globale IDs eindeutig halten, Kataloge registrieren, `prepare()` für Direktzugang anlegen, normalen Übergang ohne Reset führen und einmalige Belohnungen schützen. Neue Assets brauchen echte fertige Dateien, Manifest-Einträge, Provenienz und visuelle Prüfung. Vorhandene Ignatius-, Vamir-, Elnon-, Flick- und Kyra-Assets wiederverwenden; Teil-zwei-Orte und benötigte Posen fehlen teilweise. Die [technische Anleitung](../technical-guide.md) nennt die vorhandenen Schnittstellen und Grafikbestände.

Die parallelen Änderungen im Taktikbereich gehören zur Ausgangslage. Vor Beginn aktuellen Git-Status prüfen. Kein Reset, Stash, Revert oder Einchecken fremder Arbeit. Opus soll seine Änderungen abgrenzen und fehlende gemeinsame Schnittstellen gezielt ergänzen. Der Auftrag ist vollständig implementiert und lokal geprüft zu liefern; Commit, Push, Produktionsrelease und neue Sprachsynthese werden dadurch nicht beauftragt.

## Abnahme

- Alle wesentlichen Ereignisse bis etwa Filmminute 40:15 sind spielbar oder als nachvollziehbare Zwischenszene vertreten. Abspann und ASR-Musikfragmente erzeugen keine Handlung.
- Ein regulärer Durchlauf von Buch eins in Teil zwei funktioniert zusätzlich zu direkten Szeneneinstiegen. Das optionale Weiterreisen bleibt zugänglich.
- Beide Lichtstoß-Ausgangslagen und ein gewachsener Inventar- und Progressionszustand funktionieren. Kein mehrfaches Auszahlen bei Reload, Warp oder Wiederholung.
- Lia, Kyra und Flick werden bei der Trennung korrekt aus dem aktiven Begleitermodell genommen. Ein Gefangenenblick ist kein unbemerkter Wechsel der dauerhaft spielbaren Hauptfigur.
- Elnons Angriff, Flicks Flucht und Kyras Beeinflussung sind am Ende klar. Kein vorgezogenes Finale aus Teil drei.
- Typprüfung, relevante Modultests, Produktionsbuild, Kartenprüfung, Manifestprüfung und Browserregressionen bestehen. Neue Kapiteltests prüfen Ziele, Zustand und echte Eingaben statt nur Szenenaufrufe.
- Der vollständige neue Teil ist auf Desktop sowie Smartphone im Hoch- und Querformat durchgespielt. Reduzierte Bewegung, Ton aus, Reload und Rückkehr zum Titel funktionieren; Screenshots zeigen die wichtigen Orte und Momente.
- Abschlussbericht nennt implementierte Szenen, Quellenabweichungen, offene Quellenfragen, Testresultate und tatsächliche Grenzen getrennt. Der Übergang in Teil drei ist nur dann als geprüft bezeichnet, wenn der reale Folgecode vorhanden ist.

# Selantis Teil drei für Opus

Implementiere "Falscher Glaube" als vollständigen dritten Teil. Lia erhält ihren eigenen Stab, gerät unter den vermeintlichen Schutz der Paladine und erkennt die Interessen des Ordens. Kyras beeinflusste Rückkehr führt sie in Vamirs Falle. Verbündete unterbrechen das Ritual; Lia stellt Vamir, verliert Ignatius und wird als Hüterin anerkannt. Der Epilog erhält die Beziehung zwischen Lia, Kyra und Flick.

## Material und Lesereihenfolge

1. [Opus Prompt](opus-prompt.txt), [Szenenplan](story-plan.md) und [Übergabevertrag](../transition-contract.md).
2. `AGENTS.md`, aktuelle `docs/rebuild/DESIGN.md`, `README.md` und [technische Anleitung](../technical-guide.md).
3. `docs/episode-03.md` und das vollständige `sources/transcripts/03-c9oV3Lh2Lyw.txt`. Die JSON-Datei enthält deduplizierte automatische Untertitel mit Zeiten; zusätzlich liegen die ursprünglichen VTT-Dateien bei.
4. `docs/episode-02.md` und die Teil-zwei-Transkripte als Voraussetzung für Gefangenschaft, Stabtraining und Kyras Kontrolle. Wenn Teil zwei inzwischen implementiert ist, dessen tatsächlichen Schluss und Übergang prüfen.
5. Romanvolltext, Romananalyse und Mythologie für die bestehenden Figuren und Weltregeln. Originalfilm, Kontaktbögen und Schlüsselbilder dienen der Ereignisprüfung. Die aktuelle Grafikgestaltung folgt den eigenen freigegebenen Referenzbögen.

Die genaue Dateiliste steht in [Materialien](materials.md). Das ZIP enthält den eigenen Handoff und Prompt, den Quellstand sowie Originalmaterialien und Quellen für Teil drei und die nötige Kontinuität. `SNAPSHOT.json` dokumentiert die Ausgangslage, `FILES.json` die tatsächlich enthaltenen Dateien mit Größen und SHA-256-Werten. Der Quellstand liegt im Paket unter `project/`.

## Unabhängig arbeiten und später verbinden

Im Ausgangsstand ist Teil zwei noch nicht implementiert. Teil drei kann seinen eigenen Ordner `game/src/chapters/teil-3/`, Kapitel-ID `teil-3` und neue IDs mit `e3-` unabhängig erstellen. Seine direkten Einstiege stellen einen dokumentierten Abschlusszustand von Teil zwei her. Es wird keine Ersatzimplementierung von Teil zwei ergänzt.

Für die reguläre Fortsetzung gelten die IDs und Zustände im [Übergabevertrag](../transition-contract.md). Sobald Teil zwei vorhanden ist, startet Teil drei über `G.goto('e3-valentus')` mit dessen echtem Zustand. Die Vorbereitung für Warp oder Kapitelwahl darf diesen Zustand nicht überschreiben. Der Handoff trennt den lokal getesteten Standardzugang von dem erst nach Integration prüfbaren Übergang.

## Erzählerische Vorgaben

Lia entspricht Film-Triss. Elnon ist die bestehende Spielrolle für Film-Elhon. Ignatius' Vaterrolle beim Kontakt mit den Paladinen ist eine Deckgeschichte. Valentus ist eine begrenzte Erscheinung; im Epilog erscheint er, nicht der verstorbene Ignatius. Die innere Schutzwelt ist ein bewusst inszenierter innerer Raum, kein geografisch frei erkundbares Gebiet.

Kyra steht unter Einfluss. Ihre Auskünfte über die Flucht und das Lager gehören zur Falle und dürfen nicht als sichere Erzählerwahrheit erscheinen. Ihre Befreiung verlangt keine vorgezogene Vergebung eines frei gewählten Verrats. Die Urmacht schützt Lia weder vor Erschöpfung noch vor Gefangenschaft oder Vergiftung. Kein unbegrenzter Schutzbonus, keine automatische Heilung, kein unbelegtes Gegenmittel.

Die geliehene Waffe Schattentöter und Lias eigener Stab sind getrennte Gegenstände. Im Verlauf legt Lia ihren Stab in der Stadt zurück; Flick bringt ihn beim Ritual wieder. Diese Ereignisse müssen auch in Inventar, Darstellung und verfügbaren Handlungen gelten.

Das Ritual nutzt zehn Relikte aus Vamirs Beständen. Der Film liefert keine Liste individueller Reliktnamen und keinen Auftrag, dass Lia sie zunächst sammeln müsste. Unterbrechung, Rettung und Konfrontation werden spielbar gestaltet; neue Kampfmechaniken werden als Adaption dokumentiert. Eine gewöhnliche gewonnene Lagerschlacht ersetzt Vamirs persönliche Niederlage nicht.

Ignatius' Tod und Aussöhnung erhalten Zeit und konkrete, neu geschriebene deutsche Dialoge. Gwynn wird nicht nebenbei lebend befreit, wenn die geprüfte Abschiedsszene dies nicht trägt. Die institutionelle Änderung des Ordens und Lias Ernennung gehören ebenso zum Schluss wie die gemeinsame Weiterreise. Offene politische Fragen und der Verbleib aller Relikte werden nicht stillschweigend als gelöst behauptet.

## Umsetzung und Abnahme

Jede Szene hat ein spielerisches Herzstück: eigener Stab, Lauschen, Lesen, Flucht, schwindende Kraft, Widerstand, Rettung oder begrenzter taktischer Konflikt. Vorhandene Welt-, Dialog-, Interaktions- und Taktikschnittstellen tragen diese Abläufe. Neue Karten, Posen und Tafeln brauchen fertige Grafiken, Manifest-Einträge, Provenienz und visuelle Prüfung; Figuren werden nicht von Schauspielergesichtern abgeleitet.

- Alle tragenden Ereignisse bis etwa Filmminute 46:59 sind vertreten; Vorspann, Credits und unsichere Untertitelfragmente werden nicht zur Welterklärung.
- Direkte Einstiege und Kapitelwahl funktionieren ohne vorhandenen Teil zwei. Die dafür benutzten Standardzustände sind dokumentiert. Nach Integration besteht ein weiterer Test aus einem echten Teil-zwei-Spielstand ohne Reset.
- Stab erhalten, in der Stadt zurücklassen und zurückbekommen verändert den tatsächlichen Zustand. Wiederbetreten vervielfacht Gegenstände oder Belohnungen nicht.
- Die Vergiftung, Trennung und Gefangenschaft schränken Lia nachvollziehbar ein. Kyras Befreiung, Vamirs Niederlage, Ignatius' Tod, Hüterinnenstatus und die abschließende Gruppe sind eindeutig.
- Typprüfung, Modultests, Produktionsbuild, Kartenprüfung, Manifestprüfung und Browserregressionen bestehen. Neue Tests prüfen echte Ziele, Entscheidungen, Gegenstände und Eingaben.
- Der vollständige neue Teil wird auf Desktop sowie Smartphone im Hoch- und Querformat durchgespielt, einschließlich reduzierter Bewegung, Ton aus, Reload und Titelwechsel. Screenshots belegen die neuen Orte, das Ritual und den Epilog.
- Abschlussbericht dokumentiert Quellenabweichungen, offene Fragen, Testresultate und Grenzen des Übergangs. Ein vorbereitetes Testfixture wird nicht als geprüfter Kampagnendurchlauf ausgegeben.

Vor Beginn aktuellen Git-Status lesen und die laufenden fremden Taktikänderungen erhalten. Die Dateien von Teil zwei und dessen Produktionsanschluss gehören nicht zu diesem Auftrag. Kein Reset, Stash, Revert, Commit, Push, Deployment oder neue Sprachproduktion ohne weiteren Auftrag.

# Figuren und sichtbare Ausrüstung

Stand: 4. Oktober 2026. Lia und Kyra werden als eigenständige Romanfiguren gezeichnet. Gesichter und Kostüme der Schauspielerinnen dienen für diese beiden Figuren nicht mehr als Vorlage. Die früheren Film-Prompts bleiben Produktionsgeschichte.

Lia hat lange rotblonde Locken, eine weiße Bluse und einen langen braunen Rock. Beim Lesen sind ihre Locken bereits am Hinterkopf zusammengesteckt; sie ist barfuß. Für den Heimweg zieht sie Holzschuhe an. Kyra hat lange nussbraune Haare und braune Augen, trägt ein von der Arbeit schmutziges, knöchellanges beiges Kleid und dünne Lederschuhe. Laub und kleine Äste stecken in ihren Haaren. Grundlage: Roman, PDF-Seiten 6 bis 12.

| Lias Zustand | Sichtbare Ausstattung | Auslöser |
| --- | --- | --- |
| Lesen und Heimweg | Buch am linken Arm, einfache Hofkleidung und Holzschuhe nach dem Lesen | Anfang |
| Trauer und Reisevorbereitung | Freie Hände, Hofkleidung, Holzschuhe | Beim Tod des Vaters fällt das Buch ins Gras |
| Reise | Haarband, Lederschuhe, Reisebeutel und gerollte Wolldecke; Bücher in der Tasche | Reisekleidung einpacken |
| Kühler Lagerabend | Grüner Regenmantel über derselben Kleidung | Lagerankunft, bewusste visuelle Adaption |
| Schlafen und Erwachen | Grüner Mantel als Unterlage, braune Wolldecke darüber, Schuhe ausgezogen | Mantel ausbreiten und hinlegen |
| Nächster Reisetag | Mantel und Reisegepäck aufgenommen | Bewusster Aufbruch am Morgen |

Im Roman wird der Mantel am ersten Reisetag eingepackt und im ersten Lager als Unterlage verwendet (PDF-Seiten 20, 24 bis 25). Sein kurzes Tragen bei der kühlen Lagerankunft und beim nächsten Aufbruch ist eine Spieladaption des gewünschten sichtbaren Kleidungswechsels. Die Wolldecke bleibt ein eigener Gegenstand. Kleidung, Buchverlust und Mantelzustand überleben Kartenwechsel über Storyflags; Debugwarps setzen diese passend zum Kapitel zurück.

Valentus behält die gewählte schlichte blaue Robe mit hellen Längspartien in Schlacht, Cutscenes und Porträts. Sein grober schwarzer Fluchtmantel liegt darüber; in der Zuflucht ist er abgelegt und der Bauch verbunden. Die Dunkelschatten orientieren sich an den einfachen Schlachtsprites: grobe schwarze Hauben, helle Tuniken, abgenutztes Leder und mattes Eisen. Die vereinfachten Verschlüsse ersetzen den aufwendigeren Schmuck der früheren Bilder als ausdrückliche visuelle Adaption.

Die Laufzeitgrafiken liegen in `game/public/assets/`. Die neuen Figurenspezifikationen sind `design/assets/lia-novel-walk.json`, `lia-farm-walk.json`, `lia-novel-actions.json`, `lia-kyra-novel-portraits.json`, `lia-novel-closeups.json`, `valentus-consistency-delivery.json` und `darkshadows-consistency-delivery.json`. Vollständige Generierungsprompts und technische Lieferbelege bleiben dort erhalten. Die Originale und verworfenen Varianten liegen lokal unter `output/imagegen/`.

Figurenatlanten behalten 64×64-Zellen und den Fußanker `(32, 60)`. Große Nahaufnahmen bewahren ihren vollständigen Ausschnitt. Grafikprüfung und Prüfung der Bedienung sind getrennt: `scripts/verify_pixel_delivery.py` kontrolliert Lieferung und Atlasgeometrie; die Spieltests kontrollieren Zustände und Eingaben.

# Pixelvereinheitlichung: Lia und Storyfiguren

Die folgenden acht PNG-Dateien wurden mit dem eingebauten `image_gen.imagegen` erzeugt beziehungsweise gezielt überarbeitet. Die ausgewählten Rohbilder, früheren Produktionsbilder und vergrößerten Prüfansichten bleiben unter dem ignorierten Verzeichnis `output/imagegen/raw/pixel-unification-story/`.

| Datei unter game/public/assets/ | Raster | Frames | Bytes |
| --- | --- | ---: | ---: |
| sprites/lia-walk.png | 256×256, 64×64 Zellen | 16 | 14.355 |
| sprites/lia-read.png | 256×128, 64×64 Zellen | 8 | 7.192 |
| sprites/lia-hide.png | 256×128, 64×64 Zellen | 8 | 6.279 |
| sprites/story-actors.png | 256×128, 64×64 Zellen | 8 | 10.795 |
| sprites/raid-horse.png | 256×64, 64×64 Zellen | 4 | 8.826 |
| sprites/lia-story-poses.png | 256×128, 64×64 Zellen | 8 | 7.712 |
| sprites/road-travelers.png | 256×64, 128×64 Zellen | 2 | 9.773 |
| portraits/lia.png | 48×48 | 1 | 3.270 |

Gesamt: 68.202 Bytes.

## Geprüfte Darstellung

Lias Gesicht, seitliche Flechtsträhnen und gebundenes dunkelblondes bis hellbraunes Haar folgen den Filmframes. Ihre helle geraffte Bluse und der lange beige-senfgelbe Rock bleiben in den verschiedenen Zuständen erhalten. Der grüne Reisemantel ist die bereits verwendete Verbindung mit der Romanreiseausrüstung. Foltan und Azar behalten die Romanmerkmale, weil keine sicher benannten Filmframes für diese beiden vorliegen. Foltans Barett wurde gezielt zu schlichtem braunem Leder ohne Feder korrigiert.

Die Lia-Atlanten teilen eine Palette aus 24 Farben, einschließlich des grünen Reisemantels. Die anderen Figuren besitzen höchstens 24 Farben je Frame beziehungsweise Figurenfamilie. Die stehende Lia ist 37 Pixel hoch. Erwachsene und kniende Figuren behalten ihre eigenen natürlichen Höhen.

Die neuen Duck-Frames zeigen in beiden Richtungen eine sichtbare Veränderung der Körperhaltung. Die tiefe Hocke bleibt bei derselben anatomischen Größe von Kopf und Händen. Die Schlafpose zeigt einen bekleideten, seitlich eingerollten Körper. Die gefesselte Lia sitzt in Frame 4 mit sichtbaren Hand- und Fußfesseln; Frame 5 zeigt sie stehend mit vorn gebundenen Händen. Kyra bleibt in ihrem separaten Story-Frame mit hinter dem Rücken gebundenen Händen.

Die neue Reisebegegnung zeigt einen Händler mit Pferd und Karren sowie eine getrennte anonyme Gruppe aus Gaukler, Lautenspieler und Reisender.

## Technische Prüfung

Alle sieben Spriteatlanten haben echte, aus den generierten Bildern erhaltene Transparenz. Die technische Aufbereitung bereinigt Alpha bei Schwelle 110, beschneidet die sichtbaren Umrisse, verkleinert ausschließlich mit nächstem Nachbarn und reduziert die Palette ohne Dithering. Sie zeichnet keine Figuren oder Details nach. Die sichtbaren Umrisse enden in jedem Frame bei Bodenpixel 60. Transparente Zellränder bleiben erhalten. Nach der Verkleinerung wurden alle Atlanten in vierfacher Pixelvergrößerung geprüft.

PNG-Abmessungen, RGBA-Modus, binäres Alpha, maximal 24 sichtbare RGB-Farben pro Frame und Bodenanker wurden maschinell geprüft. Das Porträt behält den bisherigen 48×48-HUD-Vertrag und besitzt 24 Farben. `git diff --check` bestand.

Die technische Aufbereitung steht separat in `scripts/build_pixel_unification_story.py`. Sie verändert ausschließlich die acht oben genannten PNGs und schreibt einen lokalen Prüfbeleg. Sie verändert keine Szenen, kein Manifest und kein gemeinsames Prolog-Buildscript.

Feine Fingergesten, Seilwindungen und einzelne Flechtsträhnen bleiben bei dieser Größe vereinfacht. Die Browserprüfung und die Registrierung der neuen Atlanten gehören zum Runtime-Auftrag. Aus dieser Bildprüfung allein wird keine vollständige Spielabnahme abgeleitet.

## Porträtkorrektur vom 3. Oktober 2026

Die unabhängige Bildprüfung beanstandete den kupferfarbenen Haarton im Porträt. Eine gezielte Bearbeitung mit dem eingebauten Imagegen änderte die Flechtfrisur zu neutralem sandfarbenem Dunkelblond bis Hellbraun. Die Aufbereitung verkleinerte nur mit nächstem Nachbarn und reduzierte auf 24 Farben; sie färbte keine Pixel manuell um. Die normalisierte Prüfansicht wurde erneut betrachtet.

Der separate Aufruf `python3 scripts/build_pixel_unification_story.py --portrait-only` bearbeitete ausschließlich das Porträt. SHA-256-Vergleiche bestätigten, dass alle bestehenden Sprite-PNGs ihre exakten Bytes behielten. Das Porträt besitzt 48×48 Pixel, RGB-Modus, 24 Farben und 3.270 Bytes. Prüfzeit: 2026-10-03T08:37:36 UTC. SHA-256: `064d0f3a5cef0548226d9d235310420eb5bc12fa77c49410caab8561dbd5a1fb`. Der vollständige Korrekturprompt steht in `pixel-unification-story-portrait.json`.

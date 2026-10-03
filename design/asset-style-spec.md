# Asset-Stil-Spezifikation Prolog-Demo (verbindlich für alle Asset-Worker)

Creative Direction: `docs/creative-direction-tutorial.md` (Abschnitte "Farbdramaturgie" und "Figurenlook nach Filmvorgabe").

## Stil
- Pixelart wie `sources/reference/artstyle/user-pixel-baseline.png`: feste, leicht erhöhte 3/4-Draufsicht (Boden quadratisch lesbar, Objekte zeigen Vorderseite), dunkle Konturen, gedämpfte natürliche Farben, klare Silhouetten, sparsame Details.
- Eine einheitliche Pixelgröße pro Bild. Keine Fotostrukturen, keine weichen Verläufe, kein Bloom, kein Text, keine Wasserzeichen, kein HUD/UI in Hintergründen und Figurenbildern.
- Figuren realistisch proportioniert (ca. 6–7 Kopfhöhen bei Erwachsenen), keine Chibi-/Comic-Köpfe.
- Effekte (Strahl, Druckwelle, Glühen, Blitz, Partikel) werden im Code gebaut. NICHT ins Bild malen – außer explizit verlangt.

## Paletten-Anker (Hex)
Magieblau #397FC1 (Valentus-Robe dunkler davon: #1F3550 / #2A4A6E, helle Bahnen #E8E2D0).
Schlacht: Stahlgrau #59616A, Schlamm-Oliv #5D6043, Rauch #34383D, Glut #D9732B.
Blut #9A3438. Flucht: Nachtblau #172535, Schwarzgrün #182A23, Mondsilber #B8C4D6.
Zuflucht: Holz #392A23, Kerze #D89B4B. Lia: Sommergold #D6AD59, Grün #52783C.

## Technische Formate (Rohbilder; die Pipeline `tools/pixelize.py` skaliert später herunter)
- Hintergründe: 16:9 Querformat, leere Bühne ohne Spielfiguren (ferne Heere als Masse sind Teil der Kulisse). Ziel nach Pipeline: 640 × 360.
- Spritesheets: transparenter Hintergrund (falls das Tool keine Transparenz liefert: vollflächig #FF00FF, keine Schatten auf dem Hintergrund). Strenges, gleichmäßiges Raster, jede Zelle gleich groß, Figur in jeder Zelle gleich groß, Füße auf derselben Höhe, genug Abstand zwischen Zellen. Ziel nach Pipeline: 32 × 48 px pro Frame (große Posen 48 × 64).
- Portraits: quadratisch, Brustbild, neutraler dunkler einfarbiger Hintergrund. Ziel: 64 × 64.
- Cutscene-Bilder: 16:9. Ziel: 640 × 360.

## Ablage (jeder Worker NUR in seine eigenen Pfade)
- Rohbilder: `output/imagegen/raw/<id>/` (alle Versuche `<id>-v1.png`, `<id>-v2.png` …, finale Wahl als `<id>.png`; Varianten als `<id>-<variante>.png`).
- Metadaten: `design/assets/<id>.json` mit `{id, kind, files:{...}, grid:{cols, rows, order:[...]}, target:{w,h}, notes, self_review}`. `grid` nur bei Spritesheets; `order` beschreibt die Zeilen/Spalten (z. B. `rows: ["south","west","east","north"], cols: ["walk0","walk1","walk2","walk3"]`).

## Selbstprüfung vor Abgabe (maximal 3 Generierungsversuche)
1. Entspricht Look den Filmvorgaben (Valentus: lange dunkle Haare, Mittelscheitel, Kinnbart, dunkelblaue Robe mit hellen Längsbahnen, KEIN Stab, KEINE Rüstung)?
2. Stimmt die Palette des Abschnitts?
3. Bei Spritesheets: gleichmäßiges Raster, gleiche Figur in jeder Zelle, Richtungen korrekt?
4. Nichts aus der Verbotsliste der Creative Direction (Burg, Runen, Schattenmonster, erfundene Wappen, Neon, Chibi)?
Schreibe das Ergebnis ehrlich in `self_review`.

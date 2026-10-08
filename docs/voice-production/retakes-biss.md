# Voice-Retakes: Kyras Beiß-Running-Gag entschärft

Kyra beißt nur noch, wo es die Handlung trägt: bei der Entführung (Kapitel I, die Gaukler in Kapitel II, der Schenkel des „Mädchens“ in Kapitel III), bei der Gefangennahme und im Turm in Teil II, in Elnons und Baris' Rückblicken in `kontrolle` und in ihrem Schlusssatz im Finale von Teil I („eine schießt, und ich beiße“). Lias eigene Wahl, Foltan in die Hand zu beißen, bleibt. Die übrigen Wiederholungen haben andere Pointen.

Keine Audiodatei erzeugt, keine API aufgerufen. **Offen:** Inventare (`story-lines.json`, `teil-2/lines.json`), Regie und öffentliche Banken sind noch nicht neu abgeleitet; das braucht die privaten Pipelinedaten unter `output/audio/` der Sprach-Worktrees. Bis dahin finden die geänderten Zeilen zur Laufzeit keine Aufnahme und laufen als Text (die Stimme wird über den Wortlaut gefunden). Unveränderte Antwortzeilen (Lia „Vielleicht. Ich erzähl’s dir unterwegs.“, Foltan „Und?“, Kyra „Ich überleg noch. Ich hab Zeit.“, Kyra „Nur, wenn’s nötig ist.“, Kyra „Fester. Ja. Mach ich. Gleich morgen.“, Druide „Das habe ich gehört.“) behalten ihre Aufnahmen.

## Kapitel I–V (Bank `audio/story`)

| Quelle | Sprecher | Alt | Neu | Regie |
|---|---|---|---|---|
| kapitel-3/eber.ts:526 | Lia (Antwort) | „Braune Haare, braune Augen. Und sie beißt, wenn man sie ärgert.“ | „Braune Haare, braune Augen. Und ein Mundwerk, vor dem sich das halbe Dorf fürchtet.“ | Liebevoll-stolz, ein kleines Lächeln trotz Sorge |
| kapitel-3/eber.ts:528 | Azar | „Sie beißt? Die gefällt mir.“ | „Ein Mundwerk? Die gefällt mir.“ | Breit grinsend, wie bisher |
| kapitel-3/kyra.ts:365 | Kyra (gefesselt) | „Und irgendwann beiß ich dich auch, Baris. Und dann lass ich nicht mehr los.“ | „Und irgendwann, Baris, bist du derjenige, der Angst hat.“ | Leise, zornig, ein Schwur durch die Zähne |
| kapitel-5/regenwald.ts:155 | Flick | „Oh. Sie beißt.“ | „Oha. Stacheln hat sie auch.“ | Spöttisch-amüsiert |
| kapitel-5/finale.ts:194 | Kyra | „Dann hätt ich dem Riesen so lang in die Waden gebissen, bis er mich freiwillig laufen lässt.“ | „Dann hätt ich dem Riesen so lang gegen die Schienbeine getreten, bis er mich freiwillig laufen lässt.“ | Fröhlich angeberisch |
| kapitel-5/finale.ts:231 | Kyra | „Wer ist Foltan? Soll ich ihn beißen?“ | „Wer ist Foltan? Soll ich ihm eine verpassen?“ | Überrascht, sofort kampfbereit |

## Teil II (Bank `audio/teil-2`)

| Quelle | Sprecher | Alt | Neu | Regie |
|---|---|---|---|---|
| teil-2/lagerangriff.ts:348 | Kyra (Ruf) | „Kommt doch! Ich beiß auch!“ | „Kommt doch! Oder seid ihr festgewachsen?“ | Lauter, frecher Lockruf |
| teil-2/lagerangriff.ts:378 | Kyra | „Und ich beiß gleich noch mal!“ | „Und ich bin noch lang nicht fertig mit euch!“ | Wütend, gepackt, ungebrochen |
| teil-2/bruderschaft.ts:183 | Kyra | „Sag das noch mal, und ich beiß dir in die Wade. Ich hab Übung.“ | „Sag das noch mal. Nur ein einziges Mal. Ich warte.“ | Leise drohend, jedes Wort einzeln |
| teil-2/bruderschaft.ts:364 | Kyra | „Lia hat unterwegs alles erzählt. Ich hab lange überlegt, ob ich dich beiße.“ | „Lia hat unterwegs alles erzählt. Ich hab lange überlegt, ob ich dir eine runterhaue.“ | Trocken, abschätzend |
| teil-2/flicks-herkunft.ts:243 | Lia (Antwort) | „Grunwald hat jetzt drei Mitglieder. Eine davon beißt.“ | „Grunwald hat jetzt drei Mitglieder. Eine davon schnarcht.“ | Neckend, warm |
| teil-2/gefangene.ts:97 | Elnon | „Beides. Sie haben Kyra nach unten gebracht. Sie hat einem in den Daumen gebissen, bevor die Tür zuging.“ | „Beides. Sie haben Kyra nach unten gebracht. Sie hat getreten und geschrien, bis die Tür zuging.“ | Grimmig, gedämpft, ein Rest Anerkennung |
| teil-2/logge.ts:182 | Kyra (Ruf) | „Soll ich ihn beißen?“ | „Soll ich ihn rauswerfen?“ | Halblaut zu Flick, misstrauisch |
| teil-2/pruefung.ts:106 | Kyra | „Dann halt ich deine Hand. Und wenn’s schiefgeht, beiß ich den Druiden.“ | „Dann halt ich deine Hand. Und wenn’s schiefgeht, verhau ich den Druiden.“ | Entschlossen, der zweite Satz mit einem Augenzwinkern |
| teil-2/taverne.ts:140 | Flick | „Wer dich jagen will, muss erst an mir vorbei. Und an ihr. Sie beißt.“ | „Wer dich jagen will, muss erst an mir vorbei. Und an ihr. Die ist schlimmer als ich.“ | Spöttisch, stolz auf Kyra |
| teil-2/zellengespraeche.ts:447/457 | Flick (Antwort) | „Kyra. Beiß ihn nächstes Mal fester. Ich halt dir den Platz an der Tür frei.“ | „Kyra. Wehr dich weiter. Noch fester. Ich halt dir den Platz an der Tür frei.“ | Durch die Wand, eindringlich und zärtlich |

Der Spielstandwert `e2-zelle-kyra` heißt für diese Wahl jetzt `wehren` statt `beissen`; er wird nur gesetzt, nicht gelesen.

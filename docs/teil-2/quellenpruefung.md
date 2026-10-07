# Quellenprüfung Teil II – Letzte Hoffnung

Stand: 07.10.2026. Prüft die offenen Punkte aus [story-plan.md, Abschnitt „Noch zu prüfen“](../handoff/teil-2/story-plan.md) und weitere Einzelfragen vor der Umsetzung von Kapitel `teil-2`.

## Methode und Grenzen

- **Ton:** Kurze Ausschnitte (5 bis 80 Sekunden) aus `sources/audio/02-XUZV9T7fEsE.wav` bzw. aus der Tonspur von `sources/videos/03-c9oV3Lh2Lyw.mp4`, jeweils einzeln mit `whisper-cli` (ggml-small, `-l de`) neu erkannt. Vergleichsbasis ist das vorhandene Transkript (whisper-large-v3-turbo). Läufe **mit** `--prompt` und Namenskandidaten übernehmen die vorgegebene Schreibweise fast wörtlich; sie zählen deshalb **nicht** als Beleg, sondern nur die Läufe ohne Prompt. „Gehört“ heißt in diesem Dokument: zwei unabhängige Erkenner stimmen überein. Ein menschliches Abhören hat nicht stattgefunden.
- **Bild:** Kontaktbögen und Einzelbilder mit `ffmpeg`, Abstände 0,5 bis 6,7 Sekunden. Arbeitsdateien liegen lokal unter `output/qa/teil-2-source/` (gitignoriert, mit den Befehlen jederzeit reproduzierbar).
- **Tonhöhe:** Eine einfache Grundfrequenzschätzung (Autokorrelation) trennt Männer- und Frauenstimmen nur in Szenen ohne Musik. In der Szene 05:01 ist sie brauchbar (Elnon ca. 130 bis 150 Hz). Im Lagerangriff (10:58 bis 11:45) liegt die Filmmusik konstant bei ca. 246 Hz. Dort ist die Messung **wertlos** und wird nicht verwendet.
- Zeitangaben sind Filmzeit `mm:ss` von Film 2, sofern nicht „F3“ davorsteht.

## Korrekturen an bestehenden Notizen

Diese Befunde widersprechen `docs/episode-02.md` bzw. dem Story-Plan und sollten dort nachgezogen werden:

1. **Rollenabspann nennt „Elnon“, nicht „Elhon“** (Abspann 42:15, Bild `sources/frames/key-02-credit-2535.jpg`). Damit stimmen Film, Roman und Spiel überein. Der Satz „Der Filmabspann nennt Elhon“ im Story-Plan ist falsch.
2. **34:51 bis 34:54 zeigt einen Schlüsselbund, keine Metallfesseln** (`sources/frames/key-02-escape-fetters.jpg`): mehrere alte Bartschlüssel an Ring und Kette auf dem Steinboden neben dem schwarz-weißen Wappenrock eines niedergestreckten Wächters.
3. **38:22 bis 38:33 zeigt keine Stadt:** Eine Wache steht auf einer steinernen Brüstung über bewaldetem Hügelland; Gebäude sind nicht zu erkennen.
4. **38:38 bis 39:19 fehlt in der Chronologie:** Hornsignal, Verfolger und eine Fliehende in Flicks Kostüm, die sich im Unterholz versteckt (siehe Frage 7).
5. **Der Ruf bei 11:00 lautet wahrscheinlich „Versteckt euch …“** (Aufforderung), nicht „Ich verstecke euch“ (siehe Frage 4).
6. **Elnon hat im Film spitze Elfenohren** (05:07, 08:32). Das passt zum Roman („der Elf mit dem vernarbten Gesicht“).

---

## 1. Name der Prüfung und des Druiden

**Belegstellen:** 05:47, 05:54, 06:20, 08:26, 16:23, 27:35

**Methode:** whisper (small ohne Prompt) im Vergleich mit large-v3-turbo. Bild für die Szene 07:00 bis 08:35.

**Befund:**

| Stelle | large-v3-turbo | small ohne Prompt |
| --- | --- | --- |
| 05:47 Druide | „Drakus, unser Druide“ | „Markus, unser Truide“ |
| 05:47 Prüfung | „Belek Baol“ | „Belek Baul“ |
| 05:54 Prüfung | „Belek Ba'ul“ | „Belek Baul“ |
| 06:20 Druide | „Trakus den Truinen“ | „Dracos den Truiden“ |
| 08:26 Prüfung | „Belegbau“ | „Beleg-Baule“ |
| 16:23 Prüfung | „Belek Ba'ul“ | nicht neu geprüft |
| 27:35 Prüfung | „Belek Baul“ | „Beleg Baul“ |

- Die Prüfung heißt an allen Stellen zweiteilig, etwa „Belek/Beleg“ plus „Baul“, mit einer betonten zweiten Silbe im zweiten Wort. Strittig sind „k“ oder „g“ und ob „Ba'ul“ getrennt gesprochen wird. Eine Schriftquelle gibt es nicht (Roman: kein Treffer, Abspann: nicht genannt).
- Beim Druiden schwankt nur der Anlaut (D, Dr, T, M); die Endung „-akus/-acos“ ist stabil. „Drakus“ kommt am häufigsten vor, ist aber nicht gesichert. Im Bild trägt der Druide eine graugrüne Kapuzenrobe, sein Gesicht ist abgewandt (07:12, 08:32). Er steht nicht im Rollenabspann.
- Der Sprecher der Zeilen ab 08:23 ist nicht eindeutig zuzuordnen.

**Folgerung für das Spiel:** **Neutral bleiben.** Im Spiel „die Prüfung“ bzw. „die Prüfung des Druiden“ und „der Druide“ verwenden. Keine ASR-Variante als Eigenname einführen.

## 2. Flicks Beziehung zur Frau in ihrer Erinnerung

**Belegstellen:** 22:05 bis 24:08, Schlüsselstelle 23:04 bis 23:06; F3 gesamt

**Methode:** whisper (small, zwei Ausschnitte, einmal mit Prompt „Mutter/Schwester“ als Gegenprobe); Bild alle 6,7 s über 22:05 bis 24:50; Volltextsuche im F3-Transkript, Gegenprüfung F3 08:05 mit whisper.

**Befund:**
- Beide Erkenner hören „Sie ist deine …“ ohne Folgewort. Unmittelbar danach (23:05) unterbricht Flick mit der Aufforderung, ihren Kopf zu verlassen. Selbst der Lauf mit „Mutter“ und „Schwester“ im Prompt ergänzt **kein** Substantiv. Die Fortsetzung fehlt also im Ton, sie wurde nicht nur schlecht erkannt.
- Im Bild gibt es keine Rückblende: Man sieht nur Flick auf dem Stuhl, Vamir mit violettem Schleier an ihrem Kopf und die Wachen. Stadt, Gefangene, Henker und Frau existieren nur in Vamirs Schilderung.
- Film 3 enthält keinen Rückbezug. Die einzige Mutter-Erwähnung (F3 08:22) gehört zu Triss („… hat mich meine Mutter gelehrt“, Lesen), nicht zu Flick. Die von Ignatius betrauerte Frau in F3 ist eine andere Figur (siehe Frage 5, Gwynn).

**Folgerung für das Spiel:** Die Frau bleibt **unbenannt und ohne Verwandtschaftsgrad**, etwa „eine Frau, die Flick nahestand“. Belegt sind eine zerstörte Stadt, eine Hinrichtung durch einen Mann Vamirs und Flicks Angst. Mutter oder Schwester wären eine neue Festlegung.

## 3. Elnon nach Kyras Stich

**Belegstellen:** 37:40 bis 38:08; F3 22:37 bis 23:20, F3 27:12 bis 27:49, F3 Epilog 46:03 bis 46:59

**Methode:** Bild (Kontaktbögen mit 2 s und 0,5 s Abstand); whisper für F3 22:30 bis 23:30; F3-Transkript und `docs/episode-03.md`.

**Befund (Film 2):**
- 37:40 bis 37:52: Elnon kniet zwischen Wachen auf der Anhöhe. Kyra legt ihm die Hand auf die Schulter.
- 37:54 bis 37:55: Sie stößt ihm das Schwert frontal in den Oberkörper, er krümmt sich nach vorn.
- Ab 37:56 ist er aus dem Bild gefallen. Kyra tritt zurück zu Vamir. **Es folgt keine weitere Einstellung von Elnon**: kein liegender Körper, keine Nahaufnahme der Wunde, keine Feststellung seines Todes im Dialog. Vamir kommentiert nur Kyras „Vorstellung“.

**Befund (Film 3):**
- F3 22:41 bis 22:53 (whisper small und YouTube-ASR übereinstimmend): Kyra erzählt Triss, Flick sei geflohen, um Hilfe zu holen. Danach hätten versprengte Rebellen die Dunkelschatten angegriffen; sie und „Elnern“ (= Elnon) hätten fliehen wollen, sie habe ihn im Chaos verloren, und man müsse ihn retten.
- Diese Aussage stammt von der noch kontrollierten Kyra. In F3 27:40 bis 27:49 erklärt Vamir den Plan, Kyra solle Triss zu einem entlegenen Rebellenlager locken, wo die Falle zuschnappt. Der Bericht über Elnon ist also Teil des Köders und kein Filmfakt.
- Im übrigen F3-Transkript und in den F3-Notizen erscheint Elnon nicht mehr, weder lebend noch tot. Der Epilog zeigt nur Triss, Kyra und Flick.

**Folgerung für das Spiel:** Belegt ist: Elnon wird auf Vamirs Befehl von Kyra niedergestochen und bricht zusammen; der Film entscheidet sein Schicksal nicht. **Nutzerentscheidung (Spielfassung):** Elnon **stirbt**. Der Stich wird im Bild gezeigt, Elnon bleibt tot in seinem Blut liegen, Baris stellt den Tod fest (Adaption, siehe [Adaptionsprotokoll](adaption.md)). Keine Rettung, keine Wiederkehr. Kyras spätere Behauptung, sie habe Elnon auf der Flucht verloren, ist in Teil 3 damit für den Spieler eine erkennbare Lüge (Teil des Köders); Lia weiß es nicht.

## 4. Lagerangriff: Wer versteckt, wer drängt zur Flucht, was geschieht

**Belegstellen:** 10:55 bis 12:14

**Methode:** Bild (0,5 s, 1 s und 2 s Abstand); whisper small mit und ohne Bandpass. Tonhöhe hier unbrauchbar (Musik, siehe Methode).

**Befund:**
- Kostüme (Taverne, Lager und Wald stimmen überein): Triss trägt einen schwarzen Umhang und hat lange gewellte Haare. Kyra trägt einen blauen Umhang. Flick trägt einen graugrünen Kittel mit dunklem Kragenumhang. Die Verteidiger tragen blau-weiße und grün-weiße Wappenröcke mit blau-weiß geteilten Schilden; einer kämpft in Rot. Die Angreifer sind schwarz gekleidet, teils mit Kapuze.
- 10:58 bis 10:59: Der Mann in Grün (Elnon) und die Wappenrock-Träger rennen zum Palisadentor. Die drei Mädchen sitzen noch.
- **11:00 bis 11:03, der Ruf:** small (zweimal, auch mit Bandpass) erkennt „Versteckt euch, ich halte sie auf“, large „Ich verstecke euch …“. Im Bild wendet sich in genau diesem Moment **Flick** den beiden Schwestern zu, steht auf und greift nach Ausrüstung, während hinter ihr der Kampf am Tor beginnt. Flick ist danach die Einzige der drei, die im Lager gefangen sitzt. Die Sprecherin ist **wahrscheinlich Flick**, aber nicht gesichert.
- 11:08 („Komm, weg hier“): Triss und Kyra verlassen das Lager; Sprecherin nicht sicher bestimmbar, dem Inhalt nach eine der Schwestern.
- 11:14 bis 11:18: Kampf im Wald zwischen dem Rot gekleideten Verteidiger und Schwarzgekleideten.
- 11:19 bis 11:31: Triss und Kyra im Wald. Kyra ist vornübergebeugt; ein Grund wird nicht genannt. Triss will die anderen nicht allein lassen. **Kyra drängt Triss zur Flucht** und ruft sie dabei mit Namen. Triss rennt (Nahaufnahme 11:29), Kyra bleibt kauernd zurück (11:30 bis 11:33).
- 11:36 bis 11:47, das Lager danach: Elnon und Flick sitzen nebeneinander an der Palisade. Ein Verteidiger im grün-weißen Wappenrock sitzt ebenfalls gefangen. **Eine rot gekleidete Person liegt bäuchlings und reglos** am Boden, daneben stecken Pfeile und ein Schwert in der Erde. Ob sie tot oder bewusstlos ist, sagen weder Bild noch Dialog. Feuer oder Zerstörung des Lagers sind nicht zu sehen.
- 11:48 bis 12:14: Baris (Augenbinde) betritt das Lager. Ein Scherge mit schwarzer Kapuze schleift ein Mädchen im blauen Umhang heran (11:55 bis 11:56, also Kyra). Baris erkennt, dass sie wieder „die Falsche“ ist, und spricht danach Flick als alte Bekannte an.

**Folgerung für das Spiel:** Belegt sind ein Angriff mit Kampf an Tor und Waldrand, Gefangennahme von Flick, Elnon, Kyra und mindestens einem weiteren Rebellen sowie eine reglose Person ohne bestätigten Tod. Das Lager wird nicht niedergebrannt, und es gibt kein gezeigtes Massaker. Wahrscheinlich gibt Flick den Befehl zum Verstecken und bleibt zurück; Kyra drängt Lia zur endgültigen Flucht und wird dabei selbst gefasst. Der Verbleib von Foltan, Azar und Alastir bleibt eine Adaption: Sie können zu den Verteidigern gehören, ohne dass eine Rolle oder ein Tod belegt wäre.

## 5. „14 Jahre“, Gwynn, Tolos, Xenovia, Schattentöter

**Belegstellen:** 27:13 bis 27:58, 16:47, 27:00, 28:47; Abspann 42:18; F3 43:44 bis 43:50

**Methode:** whisper (small) im Vergleich mit large; Bild für 27:13 bis 27:26; Abspann; Roman-Volltext.

**Befund:**
- **14 Jahre (27:33):** Beide Erkenner hören deutlich „Das erste Mal seit 14 Jahren“. Gemeint ist die Zeit, in der Ignatius die Urmacht nicht mehr spürte, bis zur Prüfung. Das Spiel setzt sechzehn Jahre seit Dunkelhain.
- **Gwynn (27:16):** Gesprochen klingt es in beiden Erkennern wie „Quinn“. Der Rollenabspann schreibt aber eindeutig **„Gwynn“**. Im Bild (27:17 bis 27:24) erscheinen nur überblendete Unterarme mit eisernen Handschellen über einem Feuer in einer Höhle; ein Gesicht ist nicht zu sehen. Laut F3 43:44 bis 43:50 sagt Ignatius sterbend, eine Frau sei längst tot gewesen und er habe es nicht wahrhaben wollen. Der Name dort ist unverständlich („… gewinnt …“), passt aber wahrscheinlich zu Gwynn.
- **Tolos (27:46):** large „Tolos“, small „Toulos“ bzw. „Tholoss“. Lautlich stabil ist „To-los“, die Schreibweise ist ungesichert (Tolos oder Tholos). Weder Abspann noch Roman nennen den Namen.
- **Xenovia (16:47, 27:00):** large zweimal „Xenovia“, small „Cenovia“ bzw. „Xeno wir“. Der **Roman schreibt „Xenovia“** (mehrfach), damit ist die Schreibweise gesichert.
- **Schattentöter (28:47):** Beide Erkenner hören identisch „Schattentöter, mein alter Zauberstock“. Gesichert.

**Folgerung für das Spiel:**
- Ignatius nennt keine „vierzehn Jahre“. Er spricht von der Zeit seit Dunkelhain, also sechzehn Jahren, oder nennt keine Zahl. Das ist eine bewusste Anpassung an den Spielkanon.
- „Gwynn“ ist als Schreibweise belegt. Ihr Zustand in Teil 2 ist Ignatius' Überzeugung, sie leide gefangen; das ist kein bestätigter Zustand.
- „Tolos“ wird gemäß DESIGN §7.1 weiter nicht genannt.
- „Xenovia“ und „Schattentöter“ sind frei verwendbar.

## 6. Wie Flick freikommt

**Belegstellen:** 34:29 bis 35:16

**Methode:** Bild (0,5 s Abstand, Einzelbilder); whisper small.

**Befund:**
- 34:29 bis 34:42: Zwei Wächter holen Flick ab; einer trägt eine schwarze Kapuze und einen weißen Wappenrock, der andere eine rote Kapuze. Ob ihre Hände dabei gefesselt sind, ist nicht erkennbar.
- 34:43 bis 34:46: **Handgemenge.** Flick schlägt sich frei, ein Wächter schreit auf (34:43) und geht zu Boden.
- 34:47 bis 34:50: Der Wächter mit schwarzer Kapuze liegt benommen am Boden und hält sich den Kopf. Untersicht auf Flick, die über ihm steht.
- 34:51 bis 34:54: Ein **Schlüsselbund** liegt neben seinem Wappenrock am Boden.
- 34:55 bis 35:16: Flick läuft zur Zelle von Elnon und Kyra. Elnon (wahrscheinlich) fragt, wie sie das geschafft hat. Ihre Antwort ist im Ton unverständlich (ASR: „falsche Trecken/Pecken“), eine Erklärung gibt es nicht. Elnon lehnt ab, mitzukommen (35:04, „… ich geh nicht“, nur small sicher), bleibt bei Kyra und schickt Flick fort, um Hilfe zu holen.
- **Kein Magieeffekt**, kein Leuchten und keine sichtbar fallenden Fesseln.

**Folgerung für das Spiel:** Flick überwältigt ihre Wächter körperlich und kommt an deren Schlüssel. Ob sie auch die Zelle aufschließen könnte, zeigt der Film nicht; Elnons Bleiben ist seine Entscheidung. Keine Magie oder Spezialfähigkeit für Flick ableiten. Ein Handgemenge mit anschließender Schlüsselübernahme ist filmnah; jede genauere Technik ist Adaption.

## 7. Schlusssequenz: Magieeffekt, Wache, Ende

**Belegstellen:** 38:10 bis 40:15

**Methode:** Bild (Abstände 5 s, 2 s, 1,5 s, 1 s; Einzelbilder); Vergleich mit F3 00:21 bis 00:35.

**Befund:**
- 38:10 bis 38:19: Vamir steht als Silhouette im Gegenlicht auf der Anhöhe über einer weiten Landschaft, neben ihm eine Wache mit Stangenwaffe.
- 38:20: Er breitet beide Arme aus, aus seinen Händen schlagen violette Blitze nach oben.
- 38:22 bis 38:33: Schnitt auf eine behelmte Wache mit Kettenhaube, weiß-dunkelblauem Wappenrock und Speer mit blau-weißem Wimpel. Sie steht auf einer steinernen Brüstung und blickt über bewaldetes Hügelland. Ab etwa 38:25 steht eine violette Blitzsäule am Horizont; die Wache hebt die Hand an die Stirn. **Gebäude oder eine Stadt sind nicht zu sehen.** Die blau-weiße Farbgebung ähnelt den Lagerverteidigern; eine Zugehörigkeit nennt der Film nicht.
- 38:38 bis 39:19 (bisher nicht notiert): Ein Mann mit roter Kapuze bläst ein Horn (38:45). Gestalten rennen durch den Wald. Eine Fliehende in grün-weißem Kittel mit dunklem Kragenumhang (Kostüm wie Flick bei 34:46) läuft auf die Kamera zu und versteckt sich im Unterholz. Vier Verfolger (rote Kapuze mit Knüppel, schwarz-weißer Wappenrock, zwei in Dunkelblau, einer mit Kettenhaube und Axt) suchen dicht neben ihrem Versteck. Wahrscheinlich ist es Flicks Flucht; F3 bestätigt später, dass Flick entkommen ist.
- 39:20 bis 39:55: Triss geht mit Schattentöter durch herbstliches Gebüsch.
- 39:55 bis 40:00: Blick aus dunklem Unterholz auf eine kleine helle Gestalt am Hang.
- 40:01 bis 40:04: Triss sitzt im Profil im Gebüsch.
- 40:07: Dicht an der Kamera geht ein **heller, langer Stoff (Gewand oder Bein) mit blau-violettem Randleuchten** durchs Bild; ein Gesicht ist nicht zu sehen. Triss trägt schwarze Beinkleider, es ist also nicht sie.
- 40:08 bis 40:11: Triss dreht sich um und blickt zurück; danach Abblende.
- 40:13 bis 40:15: Schrifttafel „ENDE“.
- F3 beginnt (00:21) im selben Waldbild mit Triss in derselben Bluse und einer türkis leuchtenden Valentus-Erscheinung in weißer Robe.

**Folgerung für das Spiel:**
- Vamirs Blitze sind ein Machtzeichen, das man aus der Ferne sieht. Ihr Zweck wird nicht erklärt.
- Die Wache auf der Brüstung kann eine Ortsandeutung bleiben; „die Stadt“ ist nicht belegt.
- Die leuchtende Gestalt am Ende ist im Film 2 namenlos. Sie kann als Übergang zur Valentus-Erscheinung in Teil 3 dienen, ohne sie hier schon zu benennen. Kein frei verfügbarer Teleport- oder Schutzzauber.
- Eine kurze Fluchtszene Flicks ist durch das Bild gedeckt.

## 8. Sprecherzuordnungen

### 01:37 bis 02:06, Taverne

**Methode:** Bild (Abstand 0,67 s und Ausschnitte), Inhalt.

| Zeit | Sprecherin | Begründung |
| --- | --- | --- |
| 01:30 bis 01:35 | Triss | Nahaufnahme, schwarzer Umhang |
| 01:37 bis 01:39 | Kyra | Nahaufnahme blauer Umhang bei 01:38, Mund offen. Wortlaut eher „Heul nicht so rum, wir/die haben …“. |
| 01:40 bis 01:45 | Triss | Nahaufnahme |
| 01:46 bis 01:47 | Kyra | Totale; Kyra gestikuliert zu Triss, Mund offen. Wortlaut unverständlich (endet auf „… verdient“). |
| 01:47 bis 01:49 | Triss, dann Kyra | Wechsel in der Totale; Flick spricht danach beide mit „euch“ an |
| 01:50 bis 01:53 | Flick | Nahaufnahme grüner Umhang |
| 01:54 bis 01:56 | Triss | Nahaufnahme |
| 01:56 bis 01:58 | Flick (wahrscheinlich) | Totale; Flick spricht mit Blick auf Triss |
| 01:58 bis 02:01 | Triss | Inhaltliche Antwort |
| 02:03 bis 02:06 | Flick | Steht auf und geht zum Wirt. Später sagt Kyra in Flicks Abwesenheit „mich und Flick“. |

Der grüne Umhang gehört Flick, der blaue Kyra, der schwarze Triss. Das ergibt sich aus dem Ausschlussprinzip und den späteren Szenen.

### 05:01 bis 05:13, Bericht

**Methode:** Bild (1 s Abstand) und Tonhöhe (Szene ohne Musik).

**Befund:** **Flick berichtet.** Sie kniet neben dem sitzenden Elnon und gestikuliert zu ihm; Elnon hört in Nahaufnahmen zu. Die Tonhöhe liegt bei 230 bis 270 Hz, Elnons Stimme in derselben Szene bei 130 bis 150 Hz. Auch der Satz bei 05:11 bis 05:13, sie habe schon viele Zauber gesehen, aber so etwas noch nie, ist weiblich und gehört **zu Flick**, nicht zu Elnon. Elnon antwortet ab 05:14.

### 11:36 bis 12:14, nach dem Angriff

**Methode:** Bild (0,5 s Abstand), Inhalt; Tonhöhe hier unbrauchbar.

| Zeit | Sprecher | Sicherheit |
| --- | --- | --- |
| 11:39 bis 11:41, Hoffnung auf Flucht der anderen | Elnon oder Flick | **offen.** Zweierbild der beiden Gefesselten; Flick wendet sich bei 11:38 Elnon zu, danach blicken beide zu Boden. Lippen nicht auswertbar. |
| 11:42 bis 11:44, allein keine Chance | Elnon oder Flick | offen, wie oben |
| 11:49 bis 11:53, Frage nach „der Kleinen“ | Baris | sicher (betritt das Lager, Augenbinde) |
| 11:54 bis 11:55, „gefunden“ | ein Scherge | sicher (schleift Kyra heran) |
| 11:55 bis 12:02, „die Falsche“ | Baris | sicher |
| 12:07 bis 12:14, Wiedersehen | Baris zu Flick | wahrscheinlich (vgl. 13:55, „die Elfe gefangen“) |

**Folgerung für das Spiel:** Die beiden Zeilen bei 11:39 und 11:42 tragen keine Handlung. Im Spiel können beide Gefangenen die Sorge um Lia ausdrücken, ohne dass eine Filmzuordnung nötig ist.

---

## Offene Kanonfragen an den Nutzer

1. **Prüfung und Druide:** Sollen sie im Spiel dauerhaft namenlos bleiben („die Prüfung“, „der Druide“)? Oder willst du eine Schreibweise festlegen, zum Beispiel „Belek Ba'ul“ und „Drakus“? Beides ist nur nach Gehör belegt.
2. **Flicks Frau:** Bleibt die hingerichtete Frau aus Flicks Erinnerung ohne Verwandtschaftsgrad? Oder soll das Spiel eine Beziehung festlegen (etwa Mutter), was über den Film hinausginge?
3. **Elnons Schicksal:** *Entschieden:* Elnon stirbt in `e2-kontrolle` sichtbar durch Kyras Hand; Kyras Bericht in Teil 3 ist eine Lüge (siehe §3).
4. **Lagerangriff:** Ist es in Ordnung, dass Flick im Spiel diejenige ist, die Lia und Kyra zum Verstecken auffordert und selbst zurückbleibt? Das ist wahrscheinlich, aber nicht sicher belegt. Und sollen Foltan, Azar und Alastir beim Angriff anwesend sein oder gerade unterwegs?
5. **Zeitangabe:** Bestätigst du, dass Ignatius' „vierzehn Jahre“ im Spiel auf sechzehn Jahre (seit Dunkelhain) angepasst oder ganz weggelassen wird?
6. **Vamirs früherer Name:** Soll „Tolos“ (Schreibweise ungesichert) irgendwann im Spiel fallen, oder bleibt es bei „Vamir“ allein?
7. **Gwynn:** Darf Ignatius sie in Teil 2 namentlich nennen und ihre Gefangenschaft über dem Feuer schildern, obwohl er in Teil 3 offenbar erkennt, dass sie längst tot war?
8. **Schlussbild:** Soll das Ende von Teil 2 die leuchtende Gestalt nur andeuten, wie im Film, oder sie bereits als Valentus erkennbar machen?

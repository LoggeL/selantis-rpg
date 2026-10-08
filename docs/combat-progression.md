# Kämpfe und langsame Progression

Die frühe Reise bietet zwei freiwillige, einmalige Begegnungen. Sie geben Lia etwas praktische Erfahrung. Die stärkere Entwicklung beginnt mit Kyra und Flick nach der Rettung. Diese Begegnungen und die spielbare Weiterreise sind Ergänzungen für das Spiel.

## Lias Entwicklung

Lia kämpft in jedem ihrer Kämpfe mit **Vaters Dolch** als Angriff (`dolch`, Waffe `vatersdolch`). Sie ist schwach, aber eine echte Kämpferin: Einen Wegelagerer der Stufe 1 wirft sie mit zwei Stichen um, gegen Dunkelschatten bleibt sie die Schwächste der Gruppe. Ihr Kampfsatz entsteht an einer Stelle aus dem Kampagnenzustand (`chapters/common/liaKit.ts`): Stein werfen immer, Versorgen mit Mutters Wundtinktur, Ausweichen und Ablenken nach Foltans Lektion in Kapitel IV, Lichtstoß sobald gelernt, Stabimpuls nur, solange sie Schattentöter trägt. Im Überfall in Teil II schweigt das Licht: dort weder Lichtstoß noch Stabimpuls.

Alle ihre Kämpfe liegen nach dem Tod der Eltern. Die passive Eigenschaft **Verzweiflung** ist deshalb von Anfang an aktiv: Bei höchstens der Hälfte ihrer Lebenspunkte richtet der Dolch zwei Schaden mehr an und trifft um zehn Prozentpunkte sicherer. Die Vorschau zeigt das als eigenen Baustein, die Figurenkarte als Eigenschaft. Beim ersten Auslösen pro Kampf ruft Lia eine kurze, unvertonte Zeile über ihre Eltern (nicht in der Rettung, dort spricht sie bereits eine aufgenommene Zeile). Ein einmaliger Hinweis erklärt Dolch und Verzweiflung im ersten Kampf, den sie bestreitet.

Jeder Kampf setzt eine Mindeststufe; ein höherer Spielstand bleibt erhalten. Budgets und Stufengrenzen halten das Wachstum langsam:

| Kampf | Mindeststufe | Wachstum höchstens | Werte bei Mindeststufe (HP/MP/Kraft/Rüstung/Tempo) | Kampfsatz neben dem Dolch |
| --- | --- | --- | --- | --- |
| K2 Wegelagerer (freiwillig) | 1 | bis Stufe 2, 100 EXP | 16/8/2/1/6 | Stein, Versorgen |
| K3 Begleitauftrag (freiwillig) | 2 | bis Stufe 3, 100 EXP | 19/10/3/1/6 | Stein, Versorgen |
| K5 Rettung | 3 | bis Stufe 4, 100 EXP | 22/12/4/2/6 | Ausweichen, Ablenken, Stein, Versorgen, Fesseln schneiden |
| K5 Weiterreise (wiederholbar) | 4 | bis Stufe 6, 70 EXP je Kampf | 25/14/5/2/6 | wie Rettung, ab dem zweiten Sieg Lichtstoß |
| Teil II Überfall | 5 | bis Stufe 6, 40 EXP | 28/16/6/3/6, Start mit halben LP | Ausweichen, Ablenken, Stein, Versorgen (kein Licht) |
| Teil II Übungskampf | 6 | bis Stufe 7, 60 EXP | 31/18/7/3/7 | Stabimpuls, Lichtstoß (falls bekannt), Ausweichen, Ablenken, Stein, Versorgen |

Der Dolch hat Kraft 3 und einen Treffermodifikator von +5 %. Schaden ist Kraft + Angriff − Rüstung des Ziels.

## Frühe Begegnungen

Am Waldweg in Kapitel II weist Foltan nach der Mittagsrast auf Fremde am Bach hin. Über "Weg am Bach prüfen" entscheidet Lia, ob die Gruppe zwei schwache Wegelagerer vertreibt oder sie umgeht. Foltan führt den Kampf, Lia sticht mit Vaters Dolch zu, wirft Steine und versorgt Verletzte. Azar hält ihr den Rücken frei. Beide Lösungen schließen die Begegnung dauerhaft ab. Umgehen gibt keine Kampf-EXP.

Im Goldenen Eber bietet der Händler einen kurzen Begleitauftrag an. Lia, Foltan und Azar bringen einen Reisenden zum nächsten Wegzeichen. Drei Räuber stehen auf dem Weg. Das Ziel ist die sichere Ankunft des Reisenden; alle Gegner zu besiegen ist nicht erforderlich. Der Abschluss gibt einmalig einen Laib Brot und eine Wundtinktur. Ablehnen lässt die Hauptgeschichte weiterlaufen und den Auftrag bis zum Verlassen der Schenke offen.

Die frühen Kämpfe vergeben fünfzehn EXP für eine nützliche Aktion, dreißig für eine Aktion, die einen Gegner kampfunfähig macht, sowie fünfzig für den Sieg. Waffen erhalten zwei AP pro nützlicher Aktion und vier AP für den Sieg. Lia erhält höchstens hundert EXP und zwölf AP pro Kampf und steigt so um höchstens eine Stufe (K2 bis Stufe 2, K3 bis Stufe 3); Foltan und Azar erhalten höchstens dreißig EXP und acht AP. Die Rettung lässt Lia höchstens bis Stufe 4 wachsen. Verlängerte Kämpfe, wiederholte Unterstützung und Fehlversuche ergeben keinen weiteren dauerhaften Fortschritt. Erfahrung und Meisterung eines verlorenen Kampfes werden verworfen.

Die abgeschlossenen Begegnungen bleiben im Kampagnenzustand gespeichert. Es gibt keinen Respawn, keine wiederholte Abschlussbelohnung und keine frühe Übungsschleife. Debug-Sprünge setzen wie bisher den gesamten Kampagnenzustand zurück.

## Auftakt in Dunkelhain

Valentus bleibt auf Level 20. Der Falke startet auf Level 7, der junge Axtkämpfer auf Level 14. Die normalen Dunkelschatten im Auftakt sind Level 7. Die ersten Gegner stehen näher an der Verteidigung; der Axtkämpfer kommt ebenfalls näher am Hang an und erreicht mit vier Bewegungsfeldern und zwei Höhenstufen die Verteidiger früher.

Valentus kann die gewöhnlichen Gegner weiterhin beherrschen. Der Falke muss Position und Deckung beachten, insbesondere gegen den Axtkämpfer. Der Schutz der Verwundeten und das Ende des Rückzugs bleiben die Ziele. Der spätere Baris startet weiterhin auf Level 16.

## Nach der Rettung

Nach dem gemeinsamen Aufbruch im Finale kann der Spieler das erste Buch abschließen oder mit Lia, Flick und Kyra weiterreisen. Die optionale Szene `weiterreise` verwendet eine eigene Kartenkennung mit vorhandener Waldgrafik. Am Rastplatz lässt sich der Fortschritt der drei ansehen. "Weg sichern" startet die nächste Begegnung; Geländeanmutung, Titel, Zufallsseed und begrenzt die Gegnerlevel wechseln zwischen den Wegabschnitten.

Erst hier sind weitere Kämpfe mit der geretteten Gruppe möglich. Nützliche Aktionen geben acht EXP, ein besiegter Gegner zwölf, ein Sieg fünfunddreißig. Pro Figur und Kampf sind höchstens siebzig EXP und sechzehn AP möglich. Stufengrenzen verhindern endloses Sammeln: Lia höchstens Stufe 6, Kyra Stufe 4, Flick Stufe 10. Nach zwei gewonnenen Begegnungen lernt Lia einen kleinen, gezielten Lichtstoß, ihren ersten echten Angriff mit der Urmacht. Die Technik ist zuvor nicht verfügbar und übernimmt nicht Valentus' Magieauswahl.

Vor jedem neuen Kampf starten die Figuren versorgt mit vollen HP und MP. "Das erste Buch abschließen" führt zu den Credits. Fortsetzen lädt die Weiterreise samt Figurenfortschritt und erlernter Technik.

## Übergang und Speichern

Während einer optionalen Begegnung schläft die bestehende Erkundungsszene. Ihre Weltfiguren, Positionen, laufenden Skripte und Timer bleiben erhalten. Nach Kampfende wird sie geweckt. Abschlussflag, Charakterfortschritt und zusätzliche Belohnungen werden gemeinsam gespeichert, bevor die Nachgespräche beginnen. Der Speicherstand enthält auch den Rückkehrpunkt.

Ein Laden während des Kampfes setzt vor der Begegnung an. Ein Laden nach ihrem bestätigten Abschluss stellt die erledigte Begegnung und den Rückkehrpunkt wieder her. Ein vollständiger Kampfspeicherstand ist damit nicht verbunden.

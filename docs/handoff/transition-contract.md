# Übergänge zwischen den drei Teilen

Dieser Vertrag legt die vorgeschlagenen neuen IDs und die Zustände an den Grenzen der beiden Implementierungsaufträge fest. Die neuen Szenen und Flags existieren im Ausgangsstand noch nicht. Teil zwei setzt den Vertrag zuerst um; Teil drei gleicht ihn vor der Integration mit dem dann tatsächlich vorhandenen Code ab.

## Registrierung und Zuständigkeit

| Bereich | Teil zwei | Teil drei |
| --- | --- | --- |
| Neuer Kapitelordner | `game/src/chapters/teil-2/` | `game/src/chapters/teil-3/` |
| Kapitel-ID | `teil-2` | `teil-3` |
| Reihenfolge nach Kapitel V | `order: 6` | `order: 7` |
| Kapitelkarte | `numeral: 'Teil II'`, `title: 'Letzte Hoffnung'` | `numeral: 'Teil III'`, `title: 'Falscher Glaube'` |
| Szenen-, Karten-, Flag- und neue Item-IDs | `e2-...` | `e3-...` |
| Regulärer Einstieg | `e2-taverne` | `e3-valentus` |
| Letzte neue Szene | `e2-aufbruch` | `e3-epilog` |
| Teilabschluss | `e2-finished` | `e3-finished` |

Die `e2-` und `e3-` IDs der Szenenpläne werden als eigene neue Szenen eingetragen. Die bestehenden IDs `kapitel-2`, `kapitel-3`, `finale` und `weiterreise` werden nicht umbenannt. Bestehende Fähigkeiten wie `lichtstoss` behalten ihre IDs. Kein neues globales Part- oder Speichersystem ist für diese Erweiterung erforderlich.

Bei paralleler Implementierung gehören `finale.ts` und `weiterreise.ts` in Kapitel V sowie der Übergang von Teil zwei zu Teil drei der Integrationsarbeit für Teil zwei. Teil drei kann seine Szenen und direkte Einstiege bereits unabhängig erstellen. Gemeinsame Asset-, Sprecher- und Fähigkeitskataloge müssen abgestimmt bearbeitet werden.

## Teil eins zu Teil zwei

Reguläre Fortsetzung: Lia ist die Spielerfigur, Flick und Kyra sind ihre Begleiter. Im aktuellen Modell enthält `G.state.party` die Begleiter, also `['flick', 'kyra']`, ohne Lia. Kyra ist befreit. Baris lebt mit seinen Verletzungen; der Meister hat die Urmacht weiterhin nicht. Lia misstraut Foltan nach dessen verschwiegener Auskunft. Die Rückkehr zur Bruderschaft führt zu bekannten Personen, kein zweites erstes Kennenlernen.

Zwei Einstiege müssen funktionieren: nach `finale` und nach der optionalen `weiterreise`. Die bestehenden Möglichkeiten, Buch eins abzuschließen und optional weiterzureisen, bleiben verfügbar. Eine zusätzliche ausdrückliche Wahl führt nach `e2-taverne`; das bestehende Ende darf nicht stillschweigend überschrieben werden. Bereits abgeschlossene Spielstände können beim Wiederbetreten der gespeicherten Szene die neue Fortsetzung erreichen, auch wenn `k5-ende` gesetzt ist. Ein neuer Zugang darf nicht hinter dem vorhandenen Early Return verschwinden.

Der normale Übergang benutzt `G.goto()`. Er erhält Inventar, Fortschritt der Figuren, Fähigkeiten, Wissen, Erinnerungen, Entscheidungen und Kartenzustand. `G.warp()` setzt den Zustand zurück und gehört ausschließlich zu direkten Szeneneinstiegen. Die Vorbereitung für Kapitelwahl oder URL-Einstieg baut einen klar bezeichneten Standardzustand auf.

Manche Spielstände kennen bereits `lichtstoss`, andere nicht. Beide Wege werden geprüft. Ignatius trainiert im ersten Fall die Kontrolle einer vorhandenen Fähigkeit; im zweiten führt der Unterricht sie ein. Das Story-Flag `k5-urmacht` und die Fähigkeit `urmacht` sind kein Beleg für frei verfügbare oder unbegrenzte Zaubermacht. Keine pauschale Rücksetzung von Level, EXP oder erlernten Fähigkeiten beim Beginn von Teil zwei.

## Teil zwei zu Teil drei

Der Abschluss von Teil zwei und der reguläre Start von Teil drei müssen dieselbe Ausgangslage vermitteln:

| Thema | Zustand am Übergang |
| --- | --- |
| Lia | Lebt, verfügt über begrenzte Ausbildung und will ihre Freunde retten. |
| Begleiter | Lia reist allein; `party` ist leer. Kyra, Flick und Ignatius werden durch ihren jeweiligen Aufenthaltsort repräsentiert, nicht als unsichtbar aktive Kampfmitglieder. |
| Kyra | Unter Vamirs Einfluss, nicht aus freiem Willen gegen Lia. |
| Flick | Entkommen, aber noch nicht wieder mit Lia vereint. Teil drei hat eigene Zwischenszenen; deren Ortswechsel brauchen eine nachvollziehbare Brücke. |
| Ignatius | Lebt. Teil zwei löst den Mentor-Konflikt noch nicht abschließend auf. |
| Elnon | Kyras Angriff ist geschehen. **Nutzerentscheidung (2026-10-08):** Elnon ist tot; Teil II zeigt den Stich und seinen Tod (`e2-elnon-struck` = getötet). Der Spieler weiß es, Lia nicht. Keine Rettung, keine Wiederkehr; Kyras Bericht in Teil III ist eine Lüge. |
| Vamir | Lebt und besitzt die Urmacht noch nicht. Der Name ist nach Ignatius' Erklärung bekannt. |
| Stäbe | Der geliehene Schattentöter aus Teil zwei und Lias eigener Stab aus Teil drei sind unterschiedliche Objekte. |

Für die Integration reserviert: `e2-finished`, `e2-staff-received`, `e2-training-complete`, `e2-flick-escaped`, `e2-kyra-controlled`, `e2-elnon-struck`. Einmalige Gegenstandsübergaben und Belohnungen erhalten zusätzliche eigene Flags. Der geliehene Stab heißt im Katalog `e2-schattentoeter`, der eigene Stab `e3-lia-staff`. Besitz, abgelegte Ausrüstung und tatsächlicher Zugang im Kampf dürfen nicht gleichgesetzt werden. Der Szenenplan bestimmt, wann diese Gegenstände erreichbar sind.

Diese Flags sind eine neue Schnittstelle, keine schon vorhandenen Filmfakten oder Laufzeitfelder. Konkrete Kampfwerte, Zaubernamen und Ausrüstungseffekte werden aus dem vorhandenen Regelmodell abgeleitet und als Spieladaption dokumentiert. Der Zustand wird an sicheren Szenengrenzen gespeichert. Wenn der Übergang noch nicht integriert ist, endet Teil zwei sauber am Titel; Teil drei wird bis dahin über Kapitelwahl und vorbereitete Szenen getestet.

## Unabhängiger Start von Teil drei

Teil drei implementiert `prepare()` für `e3-valentus` und jede spätere direkt erreichbare Szene. Der Standardzustand enthält die vereinbarten Abschlussflags von Teil zwei sowie dessen erforderliche Kenntnisse und Ausrüstung. Er setzt keine tatsächlichen fremden Spielstände zurück. Für Szenen mit abgelegtem Stab, Gefangenschaft oder Vergiftung bildet die jeweilige Vorbereitung auch diese Einschränkungen nach.

Die reguläre Fortsetzung aus Teil zwei benutzt weiterhin `G.goto('e3-valentus')`, mit dem echten gewachsenen Spielzustand. Standardfixtures sind nur für `G.warp()` und Tests bestimmt. Mindestens ein Test muss den echten Übergang ohne Reset prüfen, sobald Teil zwei verfügbar ist. Ein bestandener Einstieg über `?scene=e3-valentus` allein bestätigt diesen Übergang nicht.

## Abnahme der Grenzen

- Normale Fortsetzung aus `finale` und `weiterreise` funktioniert mit und ohne Lichtstoß und erhält einen zuvor veränderten Inventar- und Progressionszustand.
- Laden eines alten Spielstands, Kapitelwahl, F2 und direkte URL-Einstiege funktionieren weiterhin.
- Teil zwei und Teil drei überschreiben keine IDs oder Abschlusswege von Buch eins.
- Reload und Wiederbetreten vervielfachen weder Gegenstände noch EXP oder Fähigkeiten.
- Teil drei kann lokal mit einem dokumentierten Standardzustand getestet werden; nach Integration besteht zusätzlich der Übergang aus dem realen Teil-zwei-Spielstand.

# Kapitel 3: Sprechregie

403 Einträge: 363 spoken, 13 ui, 22 sfx, 5 unresolved. Die Einträge enthalten einzelne statische Varianten von Aufrufen und Arrays. Tests und Entwicklerszenen sind ausgeschlossen. direction_en ist jeweils höchstens 153 Zeichen und ausschließlich als kurze Delivery-Anweisung für speechMetadata.style gedacht. Stimmidentität gehört in die dauerhaften Sprecherprofile.

Die SHA-256-Werte stammen aus TypeScript node.getText(sourceFile), bei gesprochenen Aufrufen aus der gesamten CallExpression. Mehrere Varianten eines Aufrufs teilen daher dessen Hash. Deklarative Map-Texte verwenden die PropertyAssignment, die 16 Liedzeilen die jeweilige StringLiteral. Diese Sonderfälle muss die Inventar-Zuordnung anhand des Quelltyps berücksichtigen.

Spielerfigur im Eber und Leselager ist Lia, am Weiher Kyra. Die aktuelle Dialogue-Implementierung verwendet jedoch valentus für alle think()-Aufrufe und für choose() ohne speaker-Override. runtime_speaker hält diese tatsächliche Auflösung fest; context_de nennt die beabsichtigte Figur. Sprecherprofile oder Inventar müssen den Szenenkontext verwenden, damit Lia und Kyra ihre eigenen Stimmen erhalten.

Lia liest im Leselager Kräuterlexikon und Alana-Geschichte vor, obwohl der Aufruf narrate() den Erzähler verwendet. Diese Einträge nennen die beabsichtigte Lesestimme ausdrücklich. Der String mit "Lia schließt die Augen" enthält Erzählerrahmen und Lias Lesung zugleich und bleibt unresolved. Keine neue Rollenaufteilung wurde erfunden.

Offen bleiben zwei dynamische Erzähler-Steuerhinweise, der generische lia()-Forwarder, ein gemischter Erzähler-/Lesetext und Azars "klack/Pfff"-Bark. Der generische Helper benötigt kein eigenes Audio.

Eber-Gedanken 87 und 183 behalten den unveränderten gesprochenen Satz; nur die Steuerhinweis-Klammer entfällt. Leselager 105 behält den gesprochenen Satz und lässt den Displayzähler weg; runtime_binding enthält die endlichen Werte 0 bis 4 und deren exakte Runtime-Texte. softCaught() 169 ist für beide übergebenen Sätze aufgelöst: wache und zeltwache verwenden Sprecher wache, algard verwendet algard. Beide Sprecher erhalten je eine Variante pro Satz; runtime_binding nennt Guard-IDs und Aufruferzeile 200 beziehungsweise 251.

Die 16 VERSES-Liedzeilen, musikalischen Tavernengesänge und der dynamische singAlong()-Bark gehören zum Song-Pfad. Keine dieser Zeilen soll als gesprochene TTS erzeugt werden. Der Trommeltakt steuert zudem das Pflock-Minispiel. Kyras stummes "…" bleibt ohne erfundene Laute. Unzitierte Auswahlhandlungen und Schweigeoptionen sind ui. Auch unzitierte Optionen mit Gesprächsabsicht, etwa "Nur weiter lauschen", bleiben UI-Handlungen.

Kein Skript wurde umgeschrieben. Keine API-Anfragen, Audiosynthese oder Git-Aktionen wurden ausgeführt.

Sieben besorgte oder traurige Azar-Zeilen tragen jetzt ausdrücklich zurückgenommene Sorge oder leise Zuwendung. Die komische Standardregie entfällt bei Foltans Geheimnis, Azars Schulden und Lias Trauer um ihre Eltern.

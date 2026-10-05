# Kapitel V: Regie und Quellabdeckung

Quelle: `origin/main` bei Commit `21fe21f5a28a2822a9309d1353ca9713d3500a0c`. Alle Kapitel-V-Dateien im Arbeitsbaum stimmen mit diesem Stand überein. Keine Testdateien oder Entwicklungsdialoge wurden berücksichtigt.

358 Einträge: 334 gesprochen, 10 UI, 1 SFX, 10 unresolved, 3 dispatch-only. Die unresolved-Einträge sind Dispatchanker. Alle endlichen statischen Textzweige dieser Stellen sind zusätzlich erfasst. `common.lia`, `bluffScene.play` und `verdict(points)` sind keine zusätzlichen Aufnahmeaufträge.

Hashes sind SHA-256 des vollständigen TypeScript-`CallExpression.getText()` bei direkten Aufrufen. `thought` und statische Bluff-`text` verwenden die jeweilige PropertyAssignment. Bluffantworten verwenden das vollständige Antworttupel, Verdictvarianten das vollständige Array. Mehrere Varianten können denselben Hash und dieselbe Zeile haben; zum Zuordnen auch Text und Sprecher verwenden.

Quoted choices repräsentieren Lias Antworten, werden aber durch die vorhandene Auswahl-API nicht noch einmal als `say` ausgegeben. Die gesprochenen Anteile brauchen einen expliziten Auswahl-Abspielpfad. `(Ohnmacht vortäuschen.)` und `(Seufzen.)` sind UI-Handlungen, keine Wörter für TTS; der unveränderte Quelltext bleibt zur Zuordnung erhalten. Stumme Auswahlhandlungen sind als UI erfasst. Geräteabhängige `controlHint`-Templates und taktische Hinweise bleiben UI.

`player` ist im Wald Lia im Reisemantel. Im Kampf ist `lia` eine Unit-ID; `schuetze` ist die Armbrustschützen-Unit ohne eigenen Sprachtext außerhalb der allgemeinen Wachenbarks. Kyras Lager-Actor hat den gebundenen Sprecher `k5-kyra-bound`; `Pah.` bleibt eine menschliche Äußerung. `Grrhhh …!` gehört zum Leichenfresser und ist SFX. Befreiungsvarianten hängen von Lia/Flick ab; verletzte Wachen und fliehende Wachen sind jeweils explizit aufgefächert.

Die Regie trennt Waldtrotz und stille Trauer, konzentriertes Fährtenlesen, das vertrauliche Feuer-Gespräch, kontrollierte Lagerdrohungen, Bluff mit gespielter Sicherheit, kurze Kampfberichte, Lias einmaligen Panikruf, Vamirs ruhige Verurteilung und den hoffnungsvollen Schluss. Dauerhafte Identitätsmerkmale gehören in das Casting, nicht in diese Regieanweisungen.

Die drei source-bound Dispatchstellen `bluffScene.ts:8`, `:11` und `:45` sind als `dispatch-only` klassifiziert. Alle BEAT_YOUNG-, BEAT_NOISE- und bedingten beatGoods-Optionen samt reply-Tupeln sowie vier Verdicttexte sind separat erfasst. Bluff-Quelldatei SHA-256: `2d0397041709e80f1727223360a6c855b14df9e4d13c27aecce81557b1044c0c`. Die drei reinen Steuerungsanzeigen `faehrte.ts:131`, `:302` und `schattenlager.ts:259` bleiben UI und sind von TTS ausgeschlossen.

Orwens Zungendrohung (`schattenlager.ts:166`) ist konkrete, kontrollierte Grausamkeit ohne spielerisches Necken.

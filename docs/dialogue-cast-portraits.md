# Dialogportraits

Jede sprechende Figur hat ein eigenes Gesicht. `portraits.ts` ordnet den
Sprechernamen einer Figur zu; `BootScene` lädt die Bilder vor dem Spielstart.
Die Dialogansicht verwendet dieselbe Zuordnung auf Canvas und im mobilen HTML.

| Sprecher | Portraitdatei unter `game/public/assets/portraits/` |
| --- | --- |
| Lia, Lia (Gedanke) | `dialogue-lia.png` |
| Lia in Überfall und Nachbereitung | `dialogue-lia-grief.png` |
| Lia auf der Reise | `dialogue-lia-determined.png` |
| Valentus | `dialogue-valentus.png` |
| Kyra | `dialogue-kyra.png` |
| Foltan, Der Schmale | `dialogue-foltan.png` |
| Azar, Der Dicke | `dialogue-azar.png` |
| Vater | `father.png` |
| Mutter | `mother.png` |
| Grauhaariger, Der Grauhaarige | `grey-haired.png` |
| Narbiger | `dialogue-scarred.png` |
| Kapuzenmann | `dialogue-hooded.png` |
| Mann in der Zuflucht | `dialogue-refuge-man.png` |
| Frau in der Zuflucht | `woman.png` |
| Junge | `boy.png` |

Die Dialogprofile sind einzelne quadratische Bilder. Explizite Emotionsangaben
können Lias Kapitelwahl überschreiben. Bei fehlenden neuen Profilen verwendet
die Ansicht vorhandene geprüfte Ausschnitte derselben Figur. Der anonyme
Platzhalter ist ausschließlich für künftig hinzugefügte unbekannte Figuren
gedacht; kein aktueller Sprecher verwendet ihn. "Fremder" kommt in den aktuellen
Dialogen nicht vor und hat deshalb keine Zuordnung.

`dialogueCoverage.test.ts` untersucht die Literale in Szenen und Erzähltexten,
Dialogarrays sowie explizite Sprecherargumente. Neue benannte Sprecher ohne
Zuordnung lassen den Test scheitern. Hinweise wie "E: Blatt fangen" und die
Beobachtung "Westen: Trapas" werden ausdrücklich ausgenommen. Der Test prüft
zusätzlich die gemeinsame Ladefunktion, das Manifest, vorhandene Bilddateien
und die mobilen Bildpfade.

Die bestehenden Gameplay- und Statistikportraits bleiben separate Dateien.
`scripts/build_portrait_assets.py` dokumentiert die Ausschnitte aus den
unveränderten Originalbildern und schreibt nur diese geprüften Ausschnitte,
keine generierten `dialogue-*.png`-Profile.

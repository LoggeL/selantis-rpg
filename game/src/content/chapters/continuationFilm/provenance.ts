/** Source/adaptation boundaries are authoring metadata, not knowledge granted to Lia. */
export const FILM_CONTINUATION_PROVENANCE = {
  novelEnd: {
    source: 'docs/novel-analysis.md:245-251; Roman Selantis 2.pdf S. 89-90',
    states: ['Lia allein im Sommerregen', 'Azar sucht Lia', 'Foltan schämt sich im Lager', 'Kyra mit Baris zur Grotte vorgesehen', 'Bruderschaft weiß vom Geweih'],
  },
  adaptations: [
    { id: 'rain-flick-encounter', kind: 'new-transition', detail: 'Flick trifft Lia nach dem ausgearbeiteten Romanende, statt während der früheren Filmflucht. Ort und Zeitpunkt dieser Begegnung sind neu.' },
    { id: 'baris-vardis-transfer', kind: 'new-transition', detail: 'Baris verfolgt den Weg zur Grotte und zum Geweih. Sein Trupp übergibt Kyra für den Weitertransport an Vardis. Das belauschte Wachgespräch verbindet die verschiedenen Hauptmänner, ohne sie gleichzusetzen.' },
    { id: 'distant-camp-coda', kind: 'narrator-perspective', detail: 'Azars erfolglose Suche und Foltans Scham aus S. 89-90 erscheinen als kurzer Erzählerblick ins entfernte Lager. Lia hört dieses Gespräch nicht.' },
    { id: 'lia-film-role', kind: 'novel-name', detail: 'Lia übernimmt bei den späteren Filmereignissen die Rolle der im Film Triss genannten Schwester.' },
    { id: 'unhealed-betrayal', kind: 'novel-continuity', detail: 'Lia akzeptiert Hilfe und möchte ihre Kraft verstehen, ohne Foltan seine Lüge zu verzeihen. Azars Suche bleibt offen; eine Rückkehr ins frühere Lager findet hier nicht statt.' },
    { id: 'walkable-actions', kind: 'playable-staging', detail: 'Fußspuren, Deckungspunkte, das Stützen Kyras und die einzelnen Rettungsaktionen machen die Filmhandlung spielbar; ihre genaue Weggeometrie ist neu.' },
  ],
  filmBeats: [
    { id: 'flick', from: '09:20', to: '14:21', detail: 'Fährtenkundige Elbin, von den Rebellen abgewiesen, Hilfe und Rast vor der Rettung.' },
    { id: 'camp', from: '14:37', to: '17:40', detail: 'Gefangene am Baum, Vardis schützt ihren Wert, Annäherung am Hang, Marktvorwand, Flick befreit und kämpft.' },
    { id: 'burst', from: '17:50', to: '18:37', detail: 'Unwillkürlicher Ausbruch stößt den gepanzerten Hauptmann zurück; Zusammenbruch, Kyra hilft, Lia versteht die Kraft nicht.' },
    { id: 'master', from: '18:50', to: '19:30', detail: 'Der unbenannte Meister bestraft Vardis für die falsche Gefangene. Kein bestätigter Tod.' },
    { id: 'departure', from: '19:42', to: '20:17', detail: 'Flick schlägt den Weg zu den Rebellen vor. Gemeinsamer Aufbruch und Schlussneckerei, vor jeder Ankunft.' },
  ],
  identities: { orwen: 'Grauer Täter des Romans', baris: 'Bärtiger Hauptmann des Romans', vardis: 'Gepanzerter Hauptmann aus Film 1', master: 'In Film 1 unbenannt' },
  endpoint: { film: 1, storyEndsAt: '20:17', creditsStartAt: '20:19', excludedRepeatStartsAt: '24:58', rebelsArrived: false },
} as const;

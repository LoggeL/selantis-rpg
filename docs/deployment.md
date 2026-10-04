# Selantis auf Dokploy

Das öffentliche Repository ist [LoggeL/selantis-rpg](https://github.com/LoggeL/selantis-rpg). Dokploy baut `main` mit dem Dockerfile im Projektstamm. Pushes auf diesen Branch lösen einen neuen Build aus.

- Spiel: https://selantis.logge.top/
- Visuelles Konzept und Räuberlied: https://selantis.logge.top/konzept.html
- Sechs Szenenstücke: https://selantis.logge.top/musik.html
- Asset-Viewer: https://selantis.logge.top/assets.html
- Release mit Commit-ID und SHA-256-Dateihashes: https://selantis.logge.top/release.json
- Healthcheck: https://selantis.logge.top/healthz

Die vorhandene Anwendung `Selantis RPG` im Projekt `Selantis`, Umgebung `production`, auf https://dokploy.logge.top verwendet den vorhandenen GitHub-Provider `LoggeL Github`. Buildpfad `/`, Branch `main`, Trigger `push`, Auto-Deploy aktiv, Dockerfile `Dockerfile`, Kontext `.` und HTTP-Port 80. Die Domain verwendet HTTPS.

## Veröffentlichen

```sh
npm run build --prefix game
git add <geänderte Dateien>
git commit -m "Beschreibung der Änderung"
git push origin main
```

Der mehrstufige Docker-Build installiert die Abhängigkeiten aus dem Lockfile, prüft TypeScript, baut mit Vite und stellt die öffentlichen Dateien zusammen. Das finale Nginx-Image enthält den Spielbuild, zwei finale Konzeptbilder und das Lied. `nginx -t` prüft die Konfiguration; der Container besitzt einen HTTP-Healthcheck. Recherchequellen, Originalmanuskript und Git-Historie gehören nicht zum ausgelieferten Inhalt. Der Docker-Kontext enthält nur die nötigen Dateien und kleine Git-Commitmetadaten.

## Lokal prüfen

```sh
npm ci --prefix game
npm test --prefix game
npm run build --prefix game
node scripts/assemble_site.mjs
python3 scripts/verify_public_release.py --commit COMMIT_SHA
```

Die öffentliche Verifikation prüft die Commit-ID, Healthcheck, Dateihashes, Medientypen, fehlende Assetpfade und MP3-Range-Anfragen. Eine erfolgreiche technische Prüfung ist keine vollständige Spielabnahme aller Szenen.

Veröffentlichungen erfolgen ausschließlich durch `git push origin main` und das dadurch ausgelöste GitHub-Auto-Deployment. Keine manuellen Builds hochladen oder Deployments per API bzw. Oberfläche starten. Diese Regel steht auch in `AGENTS.md`.

`python3 scripts/dokploy_release.py status` zeigt die aktuelle GitHub-Konfiguration und den Deploymentverlauf an. Das Werkzeug ist ausschließlich lesend; die früheren Befehle für Drop-Uploads und Provideränderungen sind entfernt. Der API-Key bleibt im macOS-Schlüsselbund unter `dokploy.logge.top API Key` und wird ausschließlich über stdin an curl übergeben. Prüfberichte liegen lokal in `output/deployment/` und werden nicht committet.

Die erste Veröffentlichung am 3. Oktober 2026 wurde über Drop hochgeladen. Die alte lokale Git-Historie ist separat gesichert; das öffentliche Repository beginnt mit einem bereinigten Stand und enthält keine verworfenen Grafikdateien.

Grundlage: [Dokploy GitHub-Provider](https://docs.dokploy.com/docs/core/github), [Dokploy Application API](https://docs.dokploy.com/docs/api/application).

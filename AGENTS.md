# Production deployments

- Publish Selantis only by pushing reviewed changes to `main` in `LoggeL/selantis-rpg`. Dokploy's GitHub integration deploys each push automatically.
- Do not upload build archives, trigger manual deployments, or change the application to the Drop provider.
- Verify the automatic deployment's status and compare `/release.json` with the pushed Git commit before reporting a release as live.
- `scripts/dokploy_release.py status` is read-only. Do not add deployment commands to this tool.
- Use Git and GitHub CLI when needed. Do not use the GitHub connector or plugin.

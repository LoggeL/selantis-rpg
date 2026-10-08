# Production deployments

- Publish Selantis only by pushing reviewed changes to `main` in `LoggeL/selantis-rpg`. Dokploy's GitHub integration deploys each push automatically.
- Do not upload build archives, trigger manual deployments, or change the application to the Drop provider.
- Verify the automatic deployment's status and compare `/release.json` with the pushed Git commit before reporting a release as live.
- `scripts/dokploy_release.py status` is read-only. Do not add deployment commands to this tool.
- Use Git and GitHub CLI when needed. Do not use the GitHub connector or plugin.

# Local workspaces

- Use the main `SelantisRPG` folder for the current development state.
- `.local/retired-worktrees/` and `.local/history-archive/` contain preserved historical work. Do not use them as the current game source.
- `.local/codex-workspaces/` links to existing Codex-managed workspaces, including unfinished voice production. Preserve their drafts and private evidence.
- Keep `.local/` out of Git commits and production build contexts.

# Validation

- Run the appropriate checks locally. Do not enable GitHub CI for this repository.

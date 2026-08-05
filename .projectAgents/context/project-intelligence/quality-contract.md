# Quality contract

Every deliverable must be verified against criteria appropriate to its artifact type.

## Project criteria

- Russian Obsidian documentation is canonical for behavior, decisions, roadmap and manual evidence.
- Goodnotes Essential remains a hard product boundary unless a new explicit canonical decision changes it.
- Export starts with an explicit Share Sheet action; Cancel performs no write.
- Automation never overwrites or deletes a source artifact and repeated export preserves prior versions.
- After explicit preview and confirmation, the plugin may move the exported copy within the vault; this never overwrites another file and never changes the editable Goodnotes original.
- The Obsidian vault uses GitHub/ObSync as its only cross-device file transport; iCloud Drive and Obsidian Sync are not enabled in parallel for this vault.
- Git divergence and conflicts fail closed and never trigger an automatic discard of local changes.
- Material product claims are traceable to canonical documentation or authoritative sources, with inference and unknowns labelled.
- Behavior is manually verified on MacBook, iPad and iPhone before being reported as complete.
- If implementation is added, only repository checks that actually exist are run and their exact results are reported.

## Declared commands

- plugin: `npm run check`
- repository-text: `git diff --check`

Never invent a successful check. Report exact commands, evidence, limitations, and residual risk.

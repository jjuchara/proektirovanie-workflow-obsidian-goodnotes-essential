# Goodnotes Handwriting Workflow

Mobile-compatible Obsidian plugin for an explicit, non-destructive handwriting flow:

```text
Obsidian source note → Apple Shortcut → Goodnotes → Share Sheet export
→ Obsidian Inbox → preview → confirmed move + sidecar + source-note embed
```

Product behavior and planning are canonical in the Russian Obsidian project documentation. This
repository contains implementation, usage, maintenance, and verification contracts only.

## Current MVP

- Starts one persisted handwriting session from the active Markdown note.
- Passes capture context to a configured Apple Shortcut using `shortcuts://run-shortcut`.
- Detects PDF, PNG, and JPEG exports in the configured Inbox.
- Restores the source-note relationship after switching applications.
- Shows a final preview before any export routing or note mutation.
- Never overwrites an attachment or sidecar; collisions receive `v02`, `v03`, and so on.
- On confirmation, moves the exported copy, creates a Markdown sidecar, and inserts a PDF/image
  embed into the source note.
- If the source note changed, requires an explicit insertion location.
- Supports explicit resume and abandon commands. Abandoning a session never deletes Inbox files.

The plugin does not read the Goodnotes library, control Git/ObSync, or provide background export.

## Commands

- `Рукописный ввод: начать`
- `Рукописный ввод: вернуться в Goodnotes`
- `Рукописный ввод: завершить`
- `Рукописный ввод: отменить сессию`

The ribbon pen icon invokes the start command.

## Required Apple Shortcuts

The plugin expects a shortcut named `Start Goodnotes Handwriting` by default. It receives a JSON text
payload and opens the Goodnotes app. The export shortcut remains a separate Share Sheet action that
saves PDF/images to the configured Inbox and opens the current device's vault. On the confirmed iPad
clone, that vault is named `MySecondBrainIpad`; on Mac it is named `MySecondBrain`.

See [docs/SHORTCUTS.md](docs/SHORTCUTS.md). Direct Shortcut access to an ObSync-managed mobile vault
is still a manual device gate.

## Development

Requirements: Node.js 20 or later.

```bash
npm install
npm run check
```

`npm run check` performs TypeScript checking, unit tests, and a production build. The release files
are `main.js`, `manifest.json`, and `styles.css`.

Do not develop or manually test this plugin in the production vault. Use a disposable vault, as
recommended by the official Obsidian plugin documentation.

## Architecture

- `src/core/` — pure naming, routing, hashing, sidecar, and Shortcut URL logic.
- `src/ui/` — Obsidian modals and explicit confirmation boundaries.
- `src/transaction.ts` — move/create/insert transaction with reverse compensation.
- `src/main.ts` — persisted session lifecycle, commands, vault events, and orchestration.
- `tests/` — pure-domain and transaction tests.

Automated checks do not prove mobile Share Sheet, app switching, ObSync, or Goodnotes behavior.

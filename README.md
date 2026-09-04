# Goodnotes Handwriting Workflow

Mobile-compatible Obsidian plugin for an explicit, non-destructive handwriting flow:

```text
Obsidian source note → Apple Shortcut → Goodnotes → Share Sheet export
→ Obsidian Inbox → preview → confirmed move + sidecar + source-note embed

Saved artifact → stored Goodnotes share link → original Goodnotes document
→ Share Sheet export → preview → confirmed full replacement at the stable vault path
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
- Stores an optional public Goodnotes share link and artifact hash in each new sidecar.
- Opens the original Goodnotes document from a selected artifact, sidecar, or source-note embed.
- Replaces the saved PDF/PNG/JPEG only after preview and confirmation, while preserving its path and
  existing embeds. The returned Inbox export is removed after the replacement succeeds.
- Fails closed if the artifact or sidecar changed after editing started, and restores both when a
  replacement step fails.

The plugin does not read the Goodnotes library, control Git/ObSync, or provide background export.
Goodnotes Essential share links are public to anyone who has the URL; using one is an explicit
opt-in. A successful edit replacement does not retain a permanent copy of the previous export.

## Commands

- `Рукописный ввод: начать`
- `Рукописный ввод: вернуться в Goodnotes`
- `Рукописный ввод: завершить`
- `Рукописный ввод: отменить сессию`
- `Рукописный ввод: редактировать сохранённый файл`
- `Рукописный ввод: вернуться к редактированию в Goodnotes`
- `Рукописный ввод: заменить отредактированный файл`
- `Рукописный ввод: отменить редактирование`

The ribbon pen icon invokes the start command.

## Required Apple Shortcuts

The plugin expects a shortcut named `Start Goodnotes Handwriting` by default. It receives a JSON text
payload and opens the Goodnotes app. The export shortcut remains a separate Share Sheet action that
saves PDF/images to the configured Inbox and opens the current device's vault. On the confirmed iPad
clone, that vault is named `MySecondBrainIpad`; on Mac it is named `MySecondBrain`.

For repeat editing, the initial review can store the original document's public Goodnotes share
link. Existing sidecars ask for the link once when editing starts. The normal Share Sheet export
Shortcut returns the edited document in the same format; the plugin then replaces the existing
artifact at its current path after a second explicit confirmation.

See [docs/SHORTCUTS.md](docs/SHORTCUTS.md). Direct Shortcut access to the ObSync-managed iPad and
iPhone vaults was manually confirmed on 2026-08-31; the new original-document edit round trip
remains a separate manual gate.

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
- `src/transaction.ts` — move/create/insert and full-replacement transactions with reverse
  compensation.
- `src/main.ts` — persisted session lifecycle, commands, vault events, and orchestration.
- `tests/` — pure-domain and transaction tests.

Automated checks do not prove mobile Share Sheet, app switching, ObSync, or Goodnotes behavior.

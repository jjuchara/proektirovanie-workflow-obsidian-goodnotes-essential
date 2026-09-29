# Goodnotes Handwriting Workflow

Start a handwriting session in Goodnotes from the Obsidian note you are working on, then bring the
exported PDF or image back into that note — with a preview and an explicit confirmation before
anything in your vault changes.

```text
Obsidian note → Apple Shortcut → Goodnotes → Share Sheet export
→ vault Inbox → preview → confirmed move + sidecar note + embed in the source note
```

Works on iPad, iPhone, and macOS. It relies only on the standard Goodnotes export and share-link
features; no Goodnotes cloud, collaboration, or AI features are used.

> This is an independent community plugin. It is not affiliated with, endorsed by, or sponsored by
> Goodnotes Limited. "Goodnotes" is a trademark of its owner.

## Features

- **Start from a note.** The start command remembers the source note and cursor position, then runs
  an Apple Shortcut that opens Goodnotes.
- **Automatic detection.** When a PDF, PNG, or JPEG export lands in the configured Inbox folder, the
  plugin opens a review dialog. This also works when the export arrives while Obsidian is closed.
- **Preview before writing.** The review shows the final file name and insertion point. Cancel
  changes nothing.
- **Safe filing.** After you confirm, the export is moved next to the source note's project, area,
  or resource folder. A Markdown sidecar note with metadata is created, and an embed (`![[…]]`) is
  inserted into the source note. Existing files are never overwritten: name collisions get `v02`,
  `v03`, and so on.
- **Fail-closed.** If the source note changed while you were in Goodnotes, you choose the insertion
  point explicitly. If a step fails, the completed steps are rolled back.
- **Re-editing.** Optionally store the Goodnotes share link of the original document. Later, reopen
  that original from the saved artifact, export it again, and replace the saved file at the same
  path. Existing embeds keep working.
- **Mobile compatible.** No desktop-only APIs.

## Requirements

- Obsidian 1.8.7 or later.
- Goodnotes on iPad, iPhone, or Mac.
- Apple Shortcuts (iOS/iPadOS 15+ or macOS 12+) for the start and export shortcuts. See
  [docs/SHORTCUTS.md](docs/SHORTCUTS.md).

## Setup

1. Install and enable the plugin.
2. Open **Settings → Goodnotes Handwriting Workflow** and set:
   - **Inbox folder** — where the export shortcut saves files (default `Inbox/Goodnotes`).
   - **Projects / Areas / Resources / Archives folders** — top-level folders of your vault. Exports
     from notes inside these folders are filed next to them; everything else stays in the Inbox.
   - **Start shortcut name** — defaults to `Start Goodnotes Handwriting`.
3. Create the two Apple Shortcuts described in [docs/SHORTCUTS.md](docs/SHORTCUTS.md).

## Usage

1. Open a note and run **Start handwriting capture** (or click the pen icon in the ribbon).
2. Write in Goodnotes, then export the page or document through the Share Sheet shortcut.
3. Back in Obsidian, review the preview and confirm.

### Commands

| Command | Purpose |
|---|---|
| Start handwriting capture | Start a session from the active note |
| Return to Goodnotes | Run the start shortcut again for the active session |
| Finish handwriting capture | Pick the export manually and open the review |
| Abandon handwriting capture | Forget the session; Inbox files are kept |
| Edit saved artifact in Goodnotes | Open the Goodnotes original of a saved export |
| Return to editing in Goodnotes | Reopen the original for the active edit |
| Replace edited artifact | Review and replace the saved file with the new export |
| Abandon artifact editing | Forget the edit session; files are kept |

The interface follows the Obsidian language setting: Russian when Obsidian uses Russian, English
otherwise.

### Where files go

For a source note `Projects/Alpha/meeting.md`:

- PDF: `Projects/Alpha/Goodnotes/exports/2026-09-29 — Handwriting — Alpha.pdf`
- PNG/JPEG: `Projects/Alpha/screens/2026-09-29 — Handwriting — Alpha.png`
- A sidecar note with the same name and `.md` extension next to the file.

The sidecar frontmatter records `source_app`, `artifact_kind`, `para`, `source_note`,
`source_link`, `artifact_path`, `artifact_hash`, and `captured`.

## Privacy and disclosures

- **No network requests and no telemetry.** The plugin does not contact any server.
- **External URLs.** The plugin opens `shortcuts://run-shortcut` to run your Apple Shortcut and, when
  you edit a saved artifact, the Goodnotes share link you provided. The shortcut receives a JSON
  payload with the session id, source note path, title, and preferred format.
- **Share links are public.** A Goodnotes share link gives access to the document to anyone who has
  the URL. It is stored in the sidecar note in your vault only if you enter one.
- **File changes.** Files are changed only after an explicit confirmation. Replacing an edited
  artifact overwrites the saved file at its path and moves the returned Inbox export to the trash,
  following your Obsidian trash setting. No permanent copy of the previous version is kept.
- **Stored state.** Settings and the active session are stored in the plugin's `data.json`.

## Development

Requirements: Node.js 20.19 or later.

```bash
npm install
npm run check   # typecheck, lint, unit tests, production build, manifest validation
npm run dev     # watch build
```

Release files are `main.js`, `manifest.json`, and `styles.css`. Pushing a tag equal to the
`manifest.json` version (for example `0.1.0`) runs `.github/workflows/release.yml`, which builds the
plugin and creates a draft GitHub release with these files.

Test in a disposable vault, not in a vault with real notes.

### Architecture

- `src/core/` — pure naming, routing, hashing, sidecar, and Shortcut URL logic.
- `src/ui/` — modals and explicit confirmation boundaries.
- `src/i18n.ts` — English and Russian interface strings.
- `src/transaction.ts` — move/create/insert and replacement transactions with rollback.
- `src/main.ts` — persisted session lifecycle, commands, vault events, and orchestration.
- `tests/` — pure-domain and transaction tests.

Automated checks do not cover the Share Sheet, app switching, or Goodnotes behavior; these are
verified manually on devices.

## License

[MIT](LICENSE)

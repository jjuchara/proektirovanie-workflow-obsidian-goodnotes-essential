# Apple Shortcuts contract

This document defines the two Apple Shortcuts the plugin expects: one that opens Goodnotes when a
session starts, and a Share Sheet shortcut that saves the Goodnotes export into the vault Inbox.

## Start Goodnotes Handwriting

Default name: `Start Goodnotes Handwriting`.

Input: text passed by the plugin through `shortcuts://run-shortcut`. The text is JSON with:

```json
{
  "captureId": "uuid",
  "sourcePath": "Projects/Example/note.md",
  "title": "Capture title",
  "preferredFormat": "png"
}
```

Minimum action sequence:

1. Accept text input.
2. Optionally show the capture title or copy it for manual Goodnotes naming.
3. Use the Shortcuts `Open App` action to open Goodnotes.

The Shortcut must not create or edit vault files.

## Goodnotes → Obsidian

Availability: Share Sheet. Accepted inputs: files, PDFs, and images.

Minimum action sequence:

1. Stop without writing when no Share Sheet input exists or the user cancels.
2. Accept one exported PDF or image from Goodnotes.
3. Use `Save File` with **Ask Where to Save** off and **Overwrite If File Exists** off, saving to the
   Inbox folder of the vault, for example
   `On My iPad/Obsidian/<Vault name>/Inbox/Goodnotes`. The folder must match the plugin's
   **Inbox folder** setting relative to the vault root.
4. Open `obsidian://open?vault=<Vault name>` (URL-encode spaces as `%20`). Use the vault name shown
   by Obsidian on that device; it can differ between devices.

If Shortcuts cannot write into the vault folder directly (for example, because a sync tool keeps it
elsewhere), save to a folder you can reach and move the file into the Inbox manually. The plugin
still detects it.

## Editing a saved artifact

The plugin reopens the original Goodnotes document through its share link; it does not import the
Obsidian PDF or image as another Goodnotes document.

1. In the original Goodnotes document, enable a shareable link and copy it. On Goodnotes Essential,
   anyone who has this URL can access the shared document.
2. Paste the URL into the initial review, or provide it once when starting an edit for an older
   sidecar.
3. In Obsidian, open the saved PDF/PNG/JPEG, its sidecar, or a Markdown note containing its embed,
   then run **Edit saved artifact in Goodnotes**.
4. Goodnotes opens the original document. Edit it and run the existing `Goodnotes → Obsidian`
   Share Sheet Shortcut, exporting the same format as the saved artifact.
5. Review the old and new paths in Obsidian and explicitly confirm the replacement.

After confirmation, the existing vault file is replaced at the same path, so Markdown embeds remain
valid. The returned Inbox export is moved to the trash only after the artifact and sidecar have both been
updated. The previous export is retained only in memory during the transaction for rollback; no
permanent revision is created. Cancel leaves the artifact, sidecar, and Inbox export unchanged.

## Manual verification checklist

- iPad: direct Save File to the vault Inbox, PDF and PNG.
- iPhone: direct Save File to the vault Inbox, PDF and PNG.
- Cancel: zero files created or changed.
- Duplicate export: prior file preserved.
- Return URI: Obsidian opens the correct vault and the plugin discovers the export.
- Original link: the command opens the same Goodnotes document on MacBook, iPad, and iPhone.
- Edit replacement: the existing embed shows the new content without changing its Markdown path.
- Edit conflict: changing the artifact or sidecar after edit start prevents replacement.
- Edit rollback: an injected sidecar/delete failure restores the previous artifact and sidecar.

# Apple Shortcuts contract

This document defines the external Shortcuts expected by the plugin. Direct access to the
ObSync-managed iPad and iPhone vaults was manually confirmed on 2026-08-31; repeat-edit behavior
still requires its own device verification.

## Start Goodnotes Handwriting

Default name: `Start Goodnotes Handwriting`.

Input: text passed by the plugin through `shortcuts://run-shortcut`. The text is JSON with:

```json
{
  "captureId": "uuid",
  "sourcePath": "1. Projects/Example/note.md",
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
3. On the confirmed iPad clone, save it without replacement to
   `On My iPad/Obsidian/MySecondBrainIpad/6. Inbox/Handwriting/Goodnotes`.
   The plugin-relative Inbox remains `6. Inbox/Handwriting/Goodnotes`.
4. On iPad, open `obsidian://open?vault=MySecondBrainIpad`. The Mac vault name is
   `MySecondBrain`; each device URI must use the name shown by Obsidian on that device.

If direct access to the ObSync clone is unavailable, save to a local staging folder and import the
file explicitly. Do not reintroduce iCloud Drive as a second vault synchronization mechanism.

## Editing a saved artifact

The plugin reopens the original Goodnotes document through its share link; it does not import the
Obsidian PDF or image as another Goodnotes document.

1. In the original Goodnotes document, enable a shareable link and copy it. On Goodnotes Essential,
   anyone who has this URL can access the shared document.
2. Paste the URL into the initial review, or provide it once when starting an edit for an older
   sidecar.
3. In Obsidian, open the saved PDF/PNG/JPEG, its sidecar, or a Markdown note containing its embed,
   then run `Рукописный ввод: редактировать сохранённый файл`.
4. Goodnotes opens the original document. Edit it and run the existing `Goodnotes → Obsidian`
   Share Sheet Shortcut, exporting the same format as the saved artifact.
5. Review the old and new paths in Obsidian and explicitly confirm the replacement.

After confirmation, the existing vault file is replaced at the same path, so Markdown embeds remain
valid. The returned Inbox export is deleted only after the artifact and sidecar have both been
updated. The previous export is retained only in memory during the transaction for rollback; no
permanent revision is created. Cancel leaves the artifact, sidecar, and Inbox export unchanged.

## Manual gate

- iPad: direct Save File to the ObSync vault, PDF and PNG.
- iPhone: direct Save File to the ObSync vault, PDF and PNG.
- Cancel: zero files created or changed.
- Duplicate export: prior file preserved.
- Return URI: Obsidian opens the correct vault and the plugin discovers the export.
- Original link: the command opens the same Goodnotes document on MacBook, iPad, and iPhone.
- Edit replacement: the existing embed shows the new content without changing its Markdown path.
- Edit conflict: changing the artifact or sidecar after edit start prevents replacement.
- Edit rollback: an injected sidecar/delete failure restores the previous artifact and sidecar.

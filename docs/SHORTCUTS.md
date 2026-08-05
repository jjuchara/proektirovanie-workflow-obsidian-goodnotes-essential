# Apple Shortcuts contract

This document defines the external Shortcuts expected by the plugin. It does not claim that direct
access to an ObSync-managed vault has been verified on iPad or iPhone.

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

## Manual gate

- iPad: direct Save File to the ObSync vault, PDF and PNG.
- iPhone: direct Save File to the ObSync vault, PDF and PNG.
- Cancel: zero files created or changed.
- Duplicate export: prior file preserved.
- Return URI: Obsidian opens the correct vault and the plugin discovers the export.

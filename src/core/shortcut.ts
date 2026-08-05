import type { PendingCapture } from "../types";

export function buildShortcutUrl(shortcutName: string, capture: PendingCapture): string {
  const payload = JSON.stringify({
    captureId: capture.id,
    sourcePath: capture.sourcePath,
    title: capture.title,
    preferredFormat: capture.preferredFormat
  });
  // Apple's Shortcuts URL scheme expects percent-encoded text. URLSearchParams
  // serializes spaces as "+", which Shortcuts treats as a literal character.
  return (
    `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}` +
    `&input=text&text=${encodeURIComponent(payload)}`
  );
}

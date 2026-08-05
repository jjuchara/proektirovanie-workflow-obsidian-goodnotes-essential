export function contentHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function insertAt(content: string, offset: number, block: string): string {
  const safeOffset = Math.max(0, Math.min(offset, content.length));
  const before = content.slice(0, safeOffset);
  const after = content.slice(safeOffset);
  const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
  const suffix = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
  return `${before}${prefix}${block.trim()}${suffix}${after}`;
}

export function appendBlock(content: string, block: string): string {
  if (content.length === 0) return `${block.trim()}\n`;
  return `${content.replace(/\s*$/, "")}\n\n${block.trim()}\n`;
}

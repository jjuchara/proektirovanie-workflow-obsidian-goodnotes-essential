export interface SidecarProvenance {
  sourceLink: string | null;
  artifactPath: string | null;
  artifactHash: string | null;
}

export interface EditedArtifactMetadata {
  sourceLink: string;
  artifactPath: string;
  artifactHash: string;
  editedAt: string;
}

export function binaryHash(content: ArrayBuffer): string {
  let hash = 0x811c9dc5;
  for (const byte of new Uint8Array(content)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeGoodnotesSourceLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "goodnotes.com" && !host.endsWith(".goodnotes.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function readSidecarProvenance(content: string): SidecarProvenance {
  return {
    sourceLink: readYamlString(content, "source_link"),
    artifactPath: readYamlString(content, "artifact_path"),
    artifactHash: readYamlString(content, "artifact_hash")
  };
}

export function updateSidecarAfterEdit(
  content: string,
  metadata: EditedArtifactMetadata
): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") throw new Error("Sidecar frontmatter is missing");
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex < 0) throw new Error("Sidecar frontmatter is not closed");

  const fields = new Map<string, string>([
    ["source_link", JSON.stringify(metadata.sourceLink)],
    ["artifact_path", JSON.stringify(metadata.artifactPath)],
    ["artifact_hash", JSON.stringify(metadata.artifactHash)],
    ["edited_at", metadata.editedAt]
  ]);

  for (let index = 1; index < closingIndex; index += 1) {
    const match = /^([a-z_]+):/.exec(lines[index] ?? "");
    const replacement = match === null ? undefined : fields.get(match[1] ?? "");
    if (replacement !== undefined && match !== null) {
      lines[index] = `${match[1]}: ${replacement}`;
      fields.delete(match[1] ?? "");
    }
  }
  lines.splice(closingIndex, 0, ...Array.from(fields, ([key, value]) => `${key}: ${value}`));
  return lines.join("\n");
}

function readYamlString(content: string, field: string): string | null {
  const match = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(content);
  if (match === null || match[1] === undefined || match[1].trim() === "null") return null;
  try {
    const value: unknown = JSON.parse(match[1]);
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

import type { Destination, WorkflowSettings } from "../types";

const SUPPORTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);

export function extensionOf(path: string): string {
  const name = path.split("/").at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isSupportedExport(path: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionOf(path));
}

export function basenameWithoutExtension(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function sanitizeSegment(value: string, fallback = "Handwriting"): string {
  const sanitized = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return sanitized || fallback;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildBaseName(captured: string, artifact: string, context: string): string {
  return `${captured} — ${sanitizeSegment(artifact)} — ${sanitizeSegment(context)}`;
}

export function inferDestination(
  sourcePath: string,
  exportPath: string,
  settings: WorkflowSettings
): Destination {
  const sourceParts = sourcePath.split("/");
  const extension = extensionOf(exportPath);
  const image = extension === "png" || extension === "jpg" || extension === "jpeg";
  const mappings: Array<[string, Destination["para"]]> = [
    [settings.projectsFolder, "project"],
    [settings.areasFolder, "area"],
    [settings.resourcesFolder, "resource"]
  ];

  for (const [root, para] of mappings) {
    if (sourceParts[0] !== root) continue;
    const rawContext = sourceParts[1] ?? basenameWithoutExtension(sourcePath);
    const context = sanitizeSegment(basenameWithoutExtension(rawContext));
    const entityRoot = sourceParts.length >= 3 ? `${root}/${rawContext}` : `${root}/${context}`;
    const projectNote =
      para !== "project"
        ? null
        : sourceParts.length >= 3
          ? `${entityRoot}/00. ${context}.md`
          : sourcePath;
    return {
      directory: image ? `${entityRoot}/screens` : `${entityRoot}/Goodnotes/exports`,
      para,
      context,
      projectNote
    };
  }

  return {
    directory: settings.inboxFolder,
    para: "inbox",
    context: sanitizeSegment(basenameWithoutExtension(sourcePath)),
    projectNote: null
  };
}

export function chooseUniquePaths(
  directory: string,
  baseName: string,
  extension: string,
  occupiedPaths: ReadonlySet<string>
): { attachmentPath: string; sidecarPath: string } {
  for (let version = 1; version < 10_000; version += 1) {
    const suffix = version === 1 ? "" : ` — v${String(version).padStart(2, "0")}`;
    const candidateBase = `${directory}/${baseName}${suffix}`;
    const attachmentPath = `${candidateBase}.${extension}`;
    const sidecarPath = `${candidateBase}.md`;
    if (!occupiedPaths.has(attachmentPath) && !occupiedPaths.has(sidecarPath)) {
      return { attachmentPath, sidecarPath };
    }
  }
  throw new Error("Unable to allocate a unique export name");
}

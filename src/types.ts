export type CaptureFormat = "pdf" | "png" | "jpeg";

export type ParaKind = "project" | "area" | "resource" | "inbox";

export type InsertionMode = "saved-cursor" | "current-cursor" | "end" | "sidecar-only";

export interface PendingCapture {
  id: string;
  sourcePath: string;
  sourceHash: string;
  cursorOffset: number;
  startedAt: number;
  title: string;
  preferredFormat: CaptureFormat;
}

export interface PendingEdit {
  id: string;
  targetPath: string;
  targetHash: string;
  sidecarPath: string;
  sidecarHash: string;
  startedAt: number;
  sourceLink: string;
}

export interface WorkflowSettings {
  inboxFolder: string;
  projectsFolder: string;
  areasFolder: string;
  resourcesFolder: string;
  archivesFolder: string;
  startShortcutName: string;
}

export interface StoredData {
  settings: WorkflowSettings;
  pendingCapture: PendingCapture | null;
  pendingEdit?: PendingEdit | null;
}

export interface Destination {
  directory: string;
  para: ParaKind;
  context: string;
  projectNote: string | null;
}

export interface ReviewInput {
  attachmentPath: string;
  sourcePath: string;
  sourceHash: string;
  artifact: string;
  context: string;
  captured: string;
  insertionMode: InsertionMode;
  insertionOffset: number | null;
}

export interface ReviewPlan extends ReviewInput {
  finalAttachmentPath: string;
  sidecarPath: string;
  para: ParaKind;
  projectNote: string | null;
  sidecarContent: string;
}

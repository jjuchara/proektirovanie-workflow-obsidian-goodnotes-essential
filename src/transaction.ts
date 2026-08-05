import { App, normalizePath, TFile } from "obsidian";
import { appendBlock, insertAt } from "./core/text";
import type { InsertionMode } from "./types";

export interface ReviewTransactionInput {
  attachment: TFile;
  finalAttachmentPath: string;
  sidecarPath: string;
  sourceNote: TFile;
  expectedSourceContent: string;
  insertionMode: InsertionMode;
  insertionOffset: number | null;
  buildSidecar: (attachmentLink: string) => string;
}

export interface ReviewTransactionResult {
  attachment: TFile;
  sidecar: TFile;
  attachmentLink: string;
}

export async function executeReviewTransaction(
  app: App,
  input: ReviewTransactionInput
): Promise<ReviewTransactionResult> {
  const vault = app.vault;
  const originalAttachmentPath = input.attachment.path;
  const finalAttachmentPath = validateVaultPath(input.finalAttachmentPath);
  const sidecarPath = validateVaultPath(input.sidecarPath);
  const sourceBefore = await vault.read(input.sourceNote);
  if (sourceBefore !== input.expectedSourceContent) {
    throw new Error("Source note changed after preview. Review it again before confirming.");
  }
  if (vault.getAbstractFileByPath(finalAttachmentPath) !== null) {
    throw new Error(`Target already exists: ${finalAttachmentPath}`);
  }
  if (vault.getAbstractFileByPath(sidecarPath) !== null) {
    throw new Error(`Sidecar already exists: ${sidecarPath}`);
  }

  await ensureParentFolder(app, finalAttachmentPath);
  await ensureParentFolder(app, sidecarPath);

  let moved = false;
  let sidecar: TFile | null = null;
  let sourceAfter: string | null = null;
  try {
    await app.fileManager.renameFile(input.attachment, finalAttachmentPath);
    moved = true;
    const attachmentLink = buildAttachmentLink(app, input.attachment, input.sourceNote);
    const sidecarContent = input.buildSidecar(attachmentLink);
    sidecar = await vault.create(sidecarPath, sidecarContent);

    if (input.insertionMode !== "sidecar-only") {
      const offset = input.insertionOffset ?? sourceBefore.length;
      sourceAfter =
        input.insertionMode === "end"
          ? appendBlock(sourceBefore, attachmentLink)
          : insertAt(sourceBefore, offset, attachmentLink);
      await vault.modify(input.sourceNote, sourceAfter);
    }

    return { attachment: input.attachment, sidecar, attachmentLink };
  } catch (error) {
    const rollbackErrors: string[] = [];
    if (sourceAfter !== null) {
      try {
        const current = await vault.read(input.sourceNote);
        if (current === sourceAfter) await vault.modify(input.sourceNote, sourceBefore);
        else rollbackErrors.push("source note changed during rollback and was preserved");
      } catch (rollbackError) {
        rollbackErrors.push(`source note: ${errorMessage(rollbackError)}`);
      }
    }
    if (sidecar !== null) {
      try {
        const current = await vault.read(sidecar);
        if (current === input.buildSidecar(buildAttachmentLink(app, input.attachment, input.sourceNote))) {
          await vault.delete(sidecar, true);
        } else {
          rollbackErrors.push("sidecar changed during rollback and was preserved");
        }
      } catch (rollbackError) {
        rollbackErrors.push(`sidecar: ${errorMessage(rollbackError)}`);
      }
    }
    if (moved) {
      try {
        if (vault.getAbstractFileByPath(originalAttachmentPath) === null) {
          await app.fileManager.renameFile(input.attachment, originalAttachmentPath);
        } else {
          rollbackErrors.push("original Inbox path is occupied; moved export was preserved");
        }
      } catch (rollbackError) {
        rollbackErrors.push(`attachment: ${errorMessage(rollbackError)}`);
      }
    }
    const rollbackSuffix = rollbackErrors.length > 0 ? ` Rollback warnings: ${rollbackErrors.join("; ")}` : "";
    throw new Error(`${errorMessage(error)}${rollbackSuffix}`);
  }
}

async function ensureParentFolder(app: App, filePath: string): Promise<void> {
  const parts = filePath.split("/").slice(0, -1);
  let current = "";
  for (const part of parts) {
    current = current.length === 0 ? part : `${current}/${part}`;
    if (app.vault.getAbstractFileByPath(current) === null) await app.vault.createFolder(current);
  }
}

function validateVaultPath(path: string): string {
  if (path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`Unsafe vault path: ${path}`);
  }
  const normalized = normalizePath(path);
  if (normalized.length === 0 || normalized === ".") throw new Error("Vault path cannot be empty");
  return normalized;
}

function buildAttachmentLink(app: App, attachment: TFile, sourceNote: TFile): string {
  const link = app.fileManager.generateMarkdownLink(attachment, sourceNote.path);
  return attachment.extension.toLowerCase() === "pdf" ? link : `!${link}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

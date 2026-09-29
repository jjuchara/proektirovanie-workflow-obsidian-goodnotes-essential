import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  normalizePath: (path: string) => path.replace(/\/{2,}/g, "/").replace(/^\.\//, ""),
  TFile: class {}
}));

import { binaryHash } from "../src/core/edit";
import { executeEditReplacementTransaction, executeReviewTransaction } from "../src/transaction";

interface FakeFile {
  path: string;
  extension: string;
  content: string;
}

class FakeVault {
  files = new Map<string, FakeFile>();
  folders = new Set<string>();
  failModify = false;
  failDelete = false;

  getAbstractFileByPath(path: string): FakeFile | object | null {
    return this.files.get(path) ?? (this.folders.has(path) ? {} : null);
  }

  async read(file: FakeFile): Promise<string> {
    return file.content;
  }

  async create(path: string, content: string): Promise<FakeFile> {
    if (this.files.has(path)) throw new Error("exists");
    const file = makeFile(path, content);
    this.files.set(path, file);
    return file;
  }

  async readBinary(file: FakeFile): Promise<ArrayBuffer> {
    return new TextEncoder().encode(file.content).buffer;
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
  }

  async process(file: FakeFile, fn: (data: string) => string): Promise<string> {
    if (this.failModify) {
      this.failModify = false;
      throw new Error("modify failed");
    }
    file.content = fn(file.content);
    return file.content;
  }

  async modifyBinary(file: FakeFile, content: ArrayBuffer): Promise<void> {
    file.content = new TextDecoder().decode(content);
  }

  async trash(file: FakeFile): Promise<void> {
    if (this.failDelete) {
      this.failDelete = false;
      throw new Error("delete failed");
    }
    this.files.delete(file.path);
  }
}

function makeFile(path: string, content = ""): FakeFile {
  return { path, extension: path.split(".").at(-1) ?? "", content };
}

function makeApp(vault: FakeVault): never {
  return {
    vault,
    fileManager: {
      async renameFile(file: FakeFile, nextPath: string): Promise<void> {
        vault.files.delete(file.path);
        file.path = nextPath;
        file.extension = nextPath.split(".").at(-1) ?? "";
        vault.files.set(nextPath, file);
      },
      async trashFile(file: FakeFile): Promise<void> {
        await vault.trash(file);
      },
      generateMarkdownLink(file: FakeFile): string {
        return `[[${file.path}]]`;
      }
    }
  } as never;
}

describe("review transaction", () => {
  let vault: FakeVault;
  let source: FakeFile;
  let attachment: FakeFile;

  beforeEach(() => {
    vault = new FakeVault();
    source = makeFile("1. Projects/Alpha/note.md", "# Note\n");
    attachment = makeFile("6. Inbox/Handwriting/Goodnotes/export.png", "binary");
    vault.files.set(source.path, source);
    vault.files.set(attachment.path, attachment);
  });

  it("moves the export, creates a sidecar and inserts an embed", async () => {
    const result = await executeReviewTransaction(makeApp(vault), {
      attachment: attachment as never,
      finalAttachmentPath: "1. Projects/Alpha/screens/final.png",
      sidecarPath: "1. Projects/Alpha/screens/final.md",
      sourceNote: source as never,
      expectedSourceContent: "# Note\n",
      insertionMode: "end",
      insertionOffset: source.content.length,
      buildSidecar: (link) => `sidecar\n${link}\n`
    });

    expect(result.attachment.path).toBe("1. Projects/Alpha/screens/final.png");
    expect(vault.files.has("6. Inbox/Handwriting/Goodnotes/export.png")).toBe(false);
    expect(vault.files.get("1. Projects/Alpha/screens/final.md")?.content).toContain("![[");
    expect(source.content).toContain("![[1. Projects/Alpha/screens/final.png]]");
  });

  it("inserts a PDF as an embed", async () => {
    vault.files.delete(attachment.path);
    attachment = makeFile("6. Inbox/Handwriting/Goodnotes/export.pdf", "binary");
    vault.files.set(attachment.path, attachment);

    const result = await executeReviewTransaction(makeApp(vault), {
      attachment: attachment as never,
      finalAttachmentPath: "1. Projects/Alpha/Goodnotes/exports/final.pdf",
      sidecarPath: "1. Projects/Alpha/Goodnotes/exports/final.md",
      sourceNote: source as never,
      expectedSourceContent: source.content,
      insertionMode: "end",
      insertionOffset: source.content.length,
      buildSidecar: (link) => `sidecar\n${link}\n`
    });

    expect(result.attachmentLink).toBe("![[1. Projects/Alpha/Goodnotes/exports/final.pdf]]");
    expect(source.content).toContain("![[1. Projects/Alpha/Goodnotes/exports/final.pdf]]");
    expect(vault.files.get("1. Projects/Alpha/Goodnotes/exports/final.md")?.content).toContain(
      "![[1. Projects/Alpha/Goodnotes/exports/final.pdf]]"
    );
  });

  it("fails before mutation when a target is occupied", async () => {
    vault.files.set("1. Projects/Alpha/screens/final.png", makeFile("1. Projects/Alpha/screens/final.png"));
    await expect(
      executeReviewTransaction(makeApp(vault), {
        attachment: attachment as never,
        finalAttachmentPath: "1. Projects/Alpha/screens/final.png",
        sidecarPath: "1. Projects/Alpha/screens/final.md",
        sourceNote: source as never,
        expectedSourceContent: source.content,
        insertionMode: "end",
        insertionOffset: source.content.length,
        buildSidecar: (link) => link
      })
    ).rejects.toThrow("Target already exists");
    expect(vault.files.has(attachment.path)).toBe(true);
    expect(source.content).toBe("# Note\n");
  });

  it("rolls the attachment and sidecar back when note insertion fails", async () => {
    vault.failModify = true;
    await expect(
      executeReviewTransaction(makeApp(vault), {
        attachment: attachment as never,
        finalAttachmentPath: "1. Projects/Alpha/screens/final.png",
        sidecarPath: "1. Projects/Alpha/screens/final.md",
        sourceNote: source as never,
        expectedSourceContent: source.content,
        insertionMode: "end",
        insertionOffset: source.content.length,
        buildSidecar: (link) => link
      })
    ).rejects.toThrow("modify failed");
    expect(vault.files.has("6. Inbox/Handwriting/Goodnotes/export.png")).toBe(true);
    expect(vault.files.has("1. Projects/Alpha/screens/final.md")).toBe(false);
    expect(source.content).toBe("# Note\n");
  });
  it("rolls back when the source note changes during confirmation", async () => {
    const vaultProcess = vault.process.bind(vault);
    vault.process = async (file, fn) => {
      if (file === source) file.content = "# Concurrent\n";
      vault.process = vaultProcess;
      return await vaultProcess(file, fn);
    };
    await expect(
      executeReviewTransaction(makeApp(vault), {
        attachment: attachment as never,
        finalAttachmentPath: "1. Projects/Alpha/screens/final.png",
        sidecarPath: "1. Projects/Alpha/screens/final.md",
        sourceNote: source as never,
        expectedSourceContent: source.content,
        insertionMode: "end",
        insertionOffset: source.content.length,
        buildSidecar: (link) => link
      })
    ).rejects.toThrow("Source note changed during confirmation");
    expect(source.content).toBe("# Concurrent\n");
    expect(vault.files.has("6. Inbox/Handwriting/Goodnotes/export.png")).toBe(true);
    expect(vault.files.has("1. Projects/Alpha/screens/final.md")).toBe(false);
  });
});

describe("edit replacement transaction", () => {
  let vault: FakeVault;
  let target: FakeFile;
  let replacement: FakeFile;
  let sidecar: FakeFile;

  beforeEach(() => {
    vault = new FakeVault();
    target = makeFile("1. Projects/Alpha/Goodnotes/exports/final.pdf", "old export");
    replacement = makeFile("6. Inbox/Handwriting/Goodnotes/edited.pdf", "new export");
    sidecar = makeFile("1. Projects/Alpha/Goodnotes/exports/final.md", "old sidecar");
    vault.files.set(target.path, target);
    vault.files.set(replacement.path, replacement);
    vault.files.set(sidecar.path, sidecar);
  });

  it("fully replaces the artifact at the stable path and removes the returned export", async () => {
    await executeEditReplacementTransaction(makeApp(vault), {
      replacement: replacement as never,
      expectedReplacementHash: binaryHash(await vault.readBinary(replacement)),
      target: target as never,
      expectedTargetHash: binaryHash(await vault.readBinary(target)),
      sidecar: sidecar as never,
      expectedSidecarContent: "old sidecar",
      updatedSidecarContent: "updated sidecar"
    });

    expect(target.path).toBe("1. Projects/Alpha/Goodnotes/exports/final.pdf");
    expect(target.content).toBe("new export");
    expect(sidecar.content).toBe("updated sidecar");
    expect(vault.files.has("6. Inbox/Handwriting/Goodnotes/edited.pdf")).toBe(false);
  });

  it("fails closed when the target changed after edit start", async () => {
    const expectedHash = binaryHash(await vault.readBinary(target));
    target.content = "concurrent change";

    await expect(
      executeEditReplacementTransaction(makeApp(vault), {
        replacement: replacement as never,
        expectedReplacementHash: binaryHash(await vault.readBinary(replacement)),
        target: target as never,
        expectedTargetHash: expectedHash,
        sidecar: sidecar as never,
        expectedSidecarContent: "old sidecar",
        updatedSidecarContent: "updated sidecar"
      })
    ).rejects.toThrow("Target artifact changed");
    expect(target.content).toBe("concurrent change");
    expect(replacement.content).toBe("new export");
  });

  it("does not replace an artifact with identical content", async () => {
    replacement.content = target.content;
    await expect(
      executeEditReplacementTransaction(makeApp(vault), {
        replacement: replacement as never,
        expectedReplacementHash: binaryHash(await vault.readBinary(replacement)),
        target: target as never,
        expectedTargetHash: binaryHash(await vault.readBinary(target)),
        sidecar: sidecar as never,
        expectedSidecarContent: "old sidecar",
        updatedSidecarContent: "updated sidecar"
      })
    ).rejects.toThrow("identical");
    expect(vault.files.has(replacement.path)).toBe(true);
  });

  it("fails closed when the returned export changes after preview", async () => {
    const previewHash = binaryHash(await vault.readBinary(replacement));
    replacement.content = "changed after preview";
    await expect(
      executeEditReplacementTransaction(makeApp(vault), {
        replacement: replacement as never,
        expectedReplacementHash: previewHash,
        target: target as never,
        expectedTargetHash: binaryHash(await vault.readBinary(target)),
        sidecar: sidecar as never,
        expectedSidecarContent: "old sidecar",
        updatedSidecarContent: "updated sidecar"
      })
    ).rejects.toThrow("Replacement export changed");
    expect(target.content).toBe("old export");
    expect(sidecar.content).toBe("old sidecar");
    expect(vault.files.has(replacement.path)).toBe(true);
  });

  it("restores the old artifact when sidecar update fails", async () => {
    vault.failModify = true;
    await expect(
      executeEditReplacementTransaction(makeApp(vault), {
        replacement: replacement as never,
        expectedReplacementHash: binaryHash(await vault.readBinary(replacement)),
        target: target as never,
        expectedTargetHash: binaryHash(await vault.readBinary(target)),
        sidecar: sidecar as never,
        expectedSidecarContent: "old sidecar",
        updatedSidecarContent: "updated sidecar"
      })
    ).rejects.toThrow("modify failed");
    expect(target.content).toBe("old export");
    expect(sidecar.content).toBe("old sidecar");
    expect(vault.files.has(replacement.path)).toBe(true);
  });

  it("rolls target and sidecar back when removing the Inbox export fails", async () => {
    vault.failDelete = true;
    await expect(
      executeEditReplacementTransaction(makeApp(vault), {
        replacement: replacement as never,
        expectedReplacementHash: binaryHash(await vault.readBinary(replacement)),
        target: target as never,
        expectedTargetHash: binaryHash(await vault.readBinary(target)),
        sidecar: sidecar as never,
        expectedSidecarContent: "old sidecar",
        updatedSidecarContent: "updated sidecar"
      })
    ).rejects.toThrow("delete failed");
    expect(target.content).toBe("old export");
    expect(sidecar.content).toBe("old sidecar");
    expect(vault.files.has(replacement.path)).toBe(true);
  });
});

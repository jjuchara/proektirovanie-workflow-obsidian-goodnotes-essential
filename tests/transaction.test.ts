import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  normalizePath: (path: string) => path.replace(/\/{2,}/g, "/").replace(/^\.\//, ""),
  TFile: class {}
}));

import { executeReviewTransaction } from "../src/transaction";

interface FakeFile {
  path: string;
  extension: string;
  content: string;
}

class FakeVault {
  files = new Map<string, FakeFile>();
  folders = new Set<string>();
  failModify = false;

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

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
  }

  async modify(file: FakeFile, content: string): Promise<void> {
    if (this.failModify) {
      this.failModify = false;
      throw new Error("modify failed");
    }
    file.content = content;
  }

  async delete(file: FakeFile): Promise<void> {
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
});

import { describe, expect, it } from "vitest";
import {
  basenameWithoutExtension,
  buildBaseName,
  chooseUniquePaths,
  formatLocalDate,
  inferDestination,
  isSupportedExport,
  sanitizeSegment
} from "../src/core/paths";
import { buildSidecar } from "../src/core/sidecar";
import { buildShortcutUrl } from "../src/core/shortcut";
import { appendBlock, contentHash, insertAt } from "../src/core/text";
import type { PendingCapture, WorkflowSettings } from "../src/types";

const DEFAULT_SETTINGS: WorkflowSettings = {
  inboxFolder: "6. Inbox/Handwriting/Goodnotes",
  projectsFolder: "1. Projects",
  areasFolder: "2. Areas",
  resourcesFolder: "3. Resources",
  archivesFolder: "4. Archives",
  startShortcutName: "Start Goodnotes Handwriting"
};

describe("paths", () => {
  it("infers a project-local destination for a PDF", () => {
    expect(
      inferDestination("1. Projects/Alpha/meeting.md", "6. Inbox/Handwriting/Goodnotes/export.pdf", DEFAULT_SETTINGS)
    ).toEqual({
      directory: "1. Projects/Alpha/Goodnotes/exports",
      para: "project",
      context: "Alpha",
      projectNote: "1. Projects/Alpha/00. Alpha.md"
    });
  });

  it("infers a project folder from a top-level project note", () => {
    expect(
      inferDestination("1. Projects/Alpha.md", "6. Inbox/Handwriting/Goodnotes/export.png", DEFAULT_SETTINGS)
        .directory
    ).toBe("1. Projects/Alpha/screens");
  });

  it("falls back to Inbox outside configured PARA roots", () => {
    expect(inferDestination("5. Daily/2026-08-05.md", "capture.jpg", DEFAULT_SETTINGS)).toMatchObject({
      directory: DEFAULT_SETTINGS.inboxFolder,
      para: "inbox",
      context: "2026-08-05"
    });
  });

  it("uses a version suffix instead of overwriting either file", () => {
    const occupied = new Set([
      "target/2026-08-05 — UML — Alpha.png",
      "target/2026-08-05 — UML — Alpha.md"
    ]);
    expect(chooseUniquePaths("target", "2026-08-05 — UML — Alpha", "png", occupied)).toEqual({
      attachmentPath: "target/2026-08-05 — UML — Alpha — v02.png",
      sidecarPath: "target/2026-08-05 — UML — Alpha — v02.md"
    });
  });

  it("sanitizes unsafe filename characters", () => {
    expect(sanitizeSegment(' API:/Flow*? "v2" ')).toBe("API Flow v2");
    expect(buildBaseName("2026-08-05", "UML", "Alpha")).toBe("2026-08-05 — UML — Alpha");
  });

  it("recognizes only supported export formats", () => {
    expect(isSupportedExport("a.PDF")).toBe(true);
    expect(isSupportedExport("a.png")).toBe(true);
    expect(isSupportedExport("a.goodnotes")).toBe(false);
    expect(basenameWithoutExtension("folder/a.b.pdf")).toBe("a.b");
  });

  it("formats a local calendar date", () => {
    expect(formatLocalDate(new Date(2026, 7, 5, 23, 59))).toBe("2026-08-05");
  });
});

describe("text", () => {
  it("hashes content deterministically", () => {
    expect(contentHash("note")).toBe(contentHash("note"));
    expect(contentHash("note")).not.toBe(contentHash("Note"));
  });

  it("inserts a block at the saved offset", () => {
    expect(insertAt("beforeafter", 6, "![[image.png]]")).toBe("before\n![[image.png]]\nafter");
  });

  it("appends a block with stable spacing", () => {
    expect(appendBlock("# Note\n", "[[file.pdf]]")).toBe("# Note\n\n[[file.pdf]]\n");
  });
});

describe("shortcut", () => {
  it("passes the pending capture as URL-encoded text", () => {
    const capture: PendingCapture = {
      id: "capture-1",
      sourcePath: "1. Projects/Alpha/meeting.md",
      sourceHash: "abcd",
      cursorOffset: 12,
      startedAt: 1,
      title: "API flow",
      preferredFormat: "png"
    };
    const rawUrl = buildShortcutUrl("Start Goodnotes Handwriting", capture);
    expect(rawUrl).toContain("name=Start%20Goodnotes%20Handwriting");
    expect(rawUrl).not.toContain("Start+Goodnotes+Handwriting");

    const url = new URL(rawUrl);
    expect(url.protocol).toBe("shortcuts:");
    expect(url.searchParams.get("name")).toBe("Start Goodnotes Handwriting");
    expect(JSON.parse(url.searchParams.get("text") ?? "{}")).toEqual({
      captureId: "capture-1",
      sourcePath: "1. Projects/Alpha/meeting.md",
      title: "API flow",
      preferredFormat: "png"
    });
  });
});

describe("sidecar", () => {
  it("keeps provenance and embeds the exported artifact", () => {
    const sidecar = buildSidecar({
      title: "2026-08-05 — UML — Alpha",
      artifact: "UML",
      para: "project",
      projectNote: "1. Projects/Alpha/meeting.md",
      captured: "2026-08-05",
      sourceNote: "1. Projects/Alpha/meeting.md",
      attachmentLink: "![[screens/diagram.png]]"
    });
    expect(sidecar).toContain("source_app: Goodnotes");
    expect(sidecar).toContain('project: "[[1. Projects/Alpha/meeting]]"');
    expect(sidecar).toContain("![[screens/diagram.png]]");
  });
});

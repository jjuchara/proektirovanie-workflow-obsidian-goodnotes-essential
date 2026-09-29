import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ getLanguage: () => "en" }));

import { messagesFor } from "../src/i18n";

describe("messages", () => {
  it("uses Russian for Russian interface languages", () => {
    expect(messagesFor("ru").commandStart).toBe("Начать рукописный ввод");
    expect(messagesFor("ru-RU").cancel).toBe("Отмена");
  });

  it("falls back to English for other languages", () => {
    expect(messagesFor("en").commandStart).toBe("Start handwriting capture");
    expect(messagesFor("de").noticeCaptureSaved("a.png")).toBe("Handwriting export saved: a.png");
  });
});

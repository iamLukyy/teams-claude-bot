import { describe, it, expect } from "vitest";
import { normalizeTeamsMarkdown } from "../src/claude/formatter.js";

describe("normalizeTeamsMarkdown", () => {
  it("moves a table glued to the intro sentence onto its own block", () => {
    const input = "Podle klienta: | Klient | Otevřených |\n|---|---|\n| HP | 15 |\nNejvíc peněz: 26A0114.";
    const out = normalizeTeamsMarkdown(input);
    expect(out).toBe("Podle klienta:\n\n| Klient | Otevřených |\n|---|---|\n| HP | 15 |\n\nNejvíc peněz: 26A0114.");
  });

  it("adds a blank line before headings and lists, not between list items", () => {
    const input = "Souhrn.\n## Varování\n- první\n- druhá\nKonec.";
    expect(normalizeTeamsMarkdown(input)).toBe("Souhrn.\n\n## Varování\n- první\n- druhá\n\nKonec.");
  });

  it("leaves code blocks and already well-formed text untouched", () => {
    const input = "Text.\n\n```\nx | y | z\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    expect(normalizeTeamsMarkdown(input)).toBe(input);
  });

  it("does not split an ordinary sentence containing a pipe", () => {
    const input = "Faktura 26207 | zaplaceno";
    expect(normalizeTeamsMarkdown(input)).toBe(input);
  });

  it("collapses runs of blank lines", () => {
    expect(normalizeTeamsMarkdown("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

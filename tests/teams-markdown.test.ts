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
    expect(normalizeTeamsMarkdown("a\n\n\n\nb")).toBe("a\n\n&nbsp;\n\nb");
  });

  it("turns bullet-character lines into real markdown list items", () => {
    const input = "Projekt:\n\n\u2022 n\u00e1klad: 60 705 K\u010d\n\u2022 v\u00fdnos: 42 600 K\u010d";
    expect(normalizeTeamsMarkdown(input)).toBe(
      "Projekt:\n\n- n\u00e1klad: 60 705 K\u010d\n- v\u00fdnos: 42 600 K\u010d",
    );
  });

  it("puts a spacer between consecutive paragraphs so Teams shows a gap", () => {
    const input = "Prvn\u00ed odstavec.\n\n**Nadpis tu\u010dn\u011b**\n\nDruh\u00fd odstavec.";
    expect(normalizeTeamsMarkdown(input)).toBe(
      "Prvn\u00ed odstavec.\n\n&nbsp;\n\n**Nadpis tu\u010dn\u011b**\n\n&nbsp;\n\nDruh\u00fd odstavec.",
    );
  });

  it("does not put a spacer around lists, tables or headings", () => {
    const input = "Souhrn.\n\n- prvn\u00ed\n- druh\u00e1\n\nKonec.";
    expect(normalizeTeamsMarkdown(input)).toBe(input);
  });

  it("does not put a spacer inside code blocks", () => {
    const input = "Text.\n\n```\na\n\nb\n```";
    expect(normalizeTeamsMarkdown(input)).toBe(input);
  });
});

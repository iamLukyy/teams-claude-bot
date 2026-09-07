import { describe, it, expect } from "vitest";
import { CONFIRM_MARKER, splitConfirmMarker } from "../src/bot/unlock.js";
import { buildConfirmCard, CONFIRM_ACTIONS } from "../src/bot/cards.js";

describe("splitConfirmMarker", () => {
  it("leaves ordinary answers untouched", () => {
    expect(splitConfirmMarker("Faktur je 14.")).toEqual({ text: "Faktur je 14.", confirm: false });
  });
  it("strips the marker line and flags the card", () => {
    const r = splitConfirmMarker(`Karta…\n\nPo potvrzení zapíšu.\n${CONFIRM_MARKER}\n`);
    expect(r.confirm).toBe(true);
    expect(r.text).toBe("Karta…\n\nPo potvrzení zapíšu.");
    expect(r.text).not.toContain(CONFIRM_MARKER);
  });
  it("also strips an inline marker", () => {
    const r = splitConfirmMarker(`Hotovo ${CONFIRM_MARKER}`);
    expect(r).toEqual({ text: "Hotovo", confirm: true });
  });
});

describe("buildConfirmCard", () => {
  it("has exactly the confirm and reject actions", () => {
    const card = buildConfirmCard() as { actions: { data: { action: string } }[] };
    const actions = card.actions.map((a) => a.data.action);
    expect(actions).toEqual(["caflou_confirm", "caflou_reject"]);
    for (const a of actions) expect(CONFIRM_ACTIONS.has(a)).toBe(true);
  });
});

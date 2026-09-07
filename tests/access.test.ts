import { describe, it, expect } from "vitest";
import { isAadAllowed, isConversationAllowed } from "../src/bot/access.js";

describe("isAadAllowed", () => {
  const allowed = new Set(["11111111-aaaa-bbbb-cccc-000000000001"]);

  it("allows everyone when the allowlist is empty (bootstrap)", () => {
    expect(isAadAllowed("anything", new Set())).toBe(true);
    expect(isAadAllowed(undefined, new Set())).toBe(true);
  });

  it("matches Entra object IDs case-insensitively", () => {
    expect(isAadAllowed("11111111-AAAA-BBBB-CCCC-000000000001", allowed)).toBe(true);
  });

  it("rejects unknown or missing IDs", () => {
    expect(isAadAllowed("22222222-aaaa-bbbb-cccc-000000000002", allowed)).toBe(false);
    expect(isAadAllowed(undefined, allowed)).toBe(false);
  });

  it("has no display-name fallback when the object ID is missing", () => {
    expect(isAadAllowed(undefined, new Set(["lukáš karel"]))).toBe(false);
  });
});

describe("isConversationAllowed", () => {
  const allowed = new Set(["19:abc@thread.v2"]);

  it("allows any conversation when the allowlist is empty", () => {
    expect(isConversationAllowed("19:xyz@thread.v2", new Set())).toBe(true);
  });

  it("locks to the configured conversation", () => {
    expect(isConversationAllowed("19:abc@thread.v2", allowed)).toBe(true);
    expect(isConversationAllowed("19:xyz@thread.v2", allowed)).toBe(false);
    expect(isConversationAllowed(undefined, allowed)).toBe(false);
  });
});

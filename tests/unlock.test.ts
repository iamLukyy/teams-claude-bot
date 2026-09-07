import { describe, it, expect, vi } from "vitest";
import { existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  DEFAULT_UNLOCK_PATTERN,
  isUnlockMessage,
  openWriteWindow,
  closeWriteWindow,
} from "../src/bot/unlock.js";

const re = new RegExp(DEFAULT_UNLOCK_PATTERN, "i");
const quiet = { log: () => {} };

describe("isUnlockMessage", () => {
  it("matches Czech/English confirmations, also after a stripped mention", () => {
    for (const t of ["potvrzuji", "Potvrzuji, zapiš", ": potvrzuji", "schvaluju", "confirm", "zapiš to"]) {
      expect(isUnlockMessage(t, re), t).toBe(true);
    }
  });
  it("ignores questions and unrelated text", () => {
    for (const t of ["kolik je tady faktur?", "nepotvrzuji", "ještě počkej", "oprav projekt na 26A0064"]) {
      expect(isUnlockMessage(t, re), t).toBe(false);
    }
  });
});

describe("write window", () => {
  it("creates the file and the closer removes it", () => {
    const file = join(mkdtempSync(join(tmpdir(), "unlock-")), "ok");
    const close = openWriteWindow(file, 60_000, quiet);
    expect(existsSync(file)).toBe(true);
    close();
    expect(existsSync(file)).toBe(false);
    closeWriteWindow(file, quiet); // idempotent
  });
  it("expires on its own after the TTL", () => {
    vi.useFakeTimers();
    const file = join(mkdtempSync(join(tmpdir(), "unlock-")), "ok");
    openWriteWindow(file, 1_000, quiet);
    expect(existsSync(file)).toBe(true);
    vi.advanceTimersByTime(1_500);
    expect(existsSync(file)).toBe(false);
    vi.useRealTimers();
  });
});

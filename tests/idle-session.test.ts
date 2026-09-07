import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const H = 3_600_000;

describe("idle session expiry (SESSION_IDLE_HOURS=12 in test config)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BOT_SESSIONS_FILE = join(
      mkdtempSync(join(tmpdir(), "teams-bot-idle-")),
      "session.json",
    );
  });

  it("is not expired shortly after activity", async () => {
    const state = await import("../src/session/state.js");
    state.touchActivity(1_000_000);
    expect(state.isIdleExpired(1_000_000 + 60_000)).toBe(false);
    expect(state.expireIdleSession(1_000_000 + 11 * H)).toBe(false);
  });

  it("never expires without any recorded activity", async () => {
    const state = await import("../src/session/state.js");
    expect(state.isIdleExpired(Date.now())).toBe(false);
  });

  it("expires after the limit and forgets the persisted session", async () => {
    const state = await import("../src/session/state.js");
    state.persistSessionId("abc");
    state.touchActivity(0);
    expect(state.loadPersistedSessionId()).toBe("abc");

    expect(state.expireIdleSession(13 * H)).toBe(true);
    expect(state.loadPersistedSessionId()).toBeUndefined();
    expect(state.getLastActivityAt()).toBeUndefined();
    // second call is a no-op
    expect(state.expireIdleSession(14 * H)).toBe(false);
  });

  it("does not resume a session that slept across a restart", async () => {
    let state = await import("../src/session/state.js");
    state.persistSessionId("old");
    state.touchActivity(Date.now() - 20 * H);

    vi.resetModules();
    state = await import("../src/session/state.js");
    state.loadPersistedState();
    expect(state.loadPersistedSessionId()).toBeUndefined();
  });

  it("resumes a session that is younger than the limit across a restart", async () => {
    let state = await import("../src/session/state.js");
    state.persistSessionId("fresh");
    state.touchActivity(Date.now() - 2 * H);

    vi.resetModules();
    state = await import("../src/session/state.js");
    state.loadPersistedState();
    expect(state.loadPersistedSessionId()).toBe("fresh");
  });
});

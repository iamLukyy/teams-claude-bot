/**
 * Write-window unlock — bridges a human confirmation in Teams to the
 * `caflou-write-guard` PreToolUse hook in the checker project.
 *
 * The hook blocks POST/PATCH/PUT/DELETE unless an unlock file exists. Only the
 * bot process (on a message from an allowlisted user that matches the confirm
 * pattern) creates that file, for one turn and at most WRITE_UNLOCK_TTL_MIN.
 */
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export const DEFAULT_UNLOCK_PATTERN =
  "^\\s*[:,\\-–]?\\s*(?:(?:ano|jo|jj|ok|okay|jasně|souhlas|souhlasím)[\\s,.!]*)?" +
  // "zapiš" / "zapiš to" count only as a WHOLE message — "zapiš to https://…" is a request, not approval
  "(potvrzuji|potvrzuju|potvrzeno|schvaluji|schvaluju|confirm(?:ed)?|(?:zapiš|zapis)(?:\\s+to)?(?=\\s*[.!]*\\s*$))";

export function isUnlockMessage(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/** Create the unlock file; returns a closer that removes it (also runs on TTL). */
export interface UnlockMeta {
  who?: string;
  aad?: string;
  conversation?: string;
  via?: "button" | "message";
}

export function openWriteWindow(
  file: string,
  ttlMs: number,
  log: Pick<Console, "log"> = console,
  meta: UnlockMeta = {},
): () => void {
  mkdirSync(dirname(file), { recursive: true });
  const payload = {
    ...meta,
    opened_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  };
  writeFileSync(file, JSON.stringify(payload) + "\n", { mode: 0o600 });
  log.log(`[WRITE] window opened (${file}), ttl ${Math.round(ttlMs / 60000)} min`);
  const timer = setTimeout(() => closeWriteWindow(file, log), ttlMs);
  timer.unref();
  return () => {
    clearTimeout(timer);
    closeWriteWindow(file, log);
  };
}

export function closeWriteWindow(
  file: string,
  log: Pick<Console, "log"> = console,
): void {
  try {
    if (existsSync(file)) {
      unlinkSync(file);
      log.log(`[WRITE] window closed (${file})`);
    }
  } catch {
    /* best-effort */
  }
}

/** Marker the Claude session puts on its own line at the end of a confirmation card. */
export const CONFIRM_MARKER = "[[POTVRDIT]]";

/** Strip the marker from a response; `confirm` tells the bridge to append the button card. */
export function splitConfirmMarker(text: string): { text: string; confirm: boolean } {
  if (!text.includes(CONFIRM_MARKER)) return { text, confirm: false };
  const cleaned = text
    .split("\n")
    .filter((line) => line.trim() !== CONFIRM_MARKER)
    .join("\n")
    .replaceAll(CONFIRM_MARKER, "")
    .trimEnd();
  return { text: cleaned, confirm: true };
}

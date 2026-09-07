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

// Three shapes count as approval:
//  1. explicit verb anywhere at the start: "potvrzuji", "jo, schvaluju", ": potvrzuji"
//  2. affirmation + zapiš with anything after: "ano zapiš to 26A0150 je to ten projekt"
//  3. a bare whole-message "zapiš" / "zapiš to" / "ano" / "ok"
// NOT approval: "zapiš tohle https://…", "zapiš to https://…", "ano, ale oprav projekt" (requests / corrections)
const AFFIRM = "(?:ano|jo|jj|ok|okay|jasně|souhlas|souhlasím)";
const VERB = "(?:potvrzuji|potvrzuju|potvrzeno|schvaluji|schvaluju|confirm(?:ed)?)";
const ZAPIS = "(?:zapiš|zapis)";
export const DEFAULT_UNLOCK_PATTERN =
  "^\\s*[:,\\-–]?\\s*(?:" +
  `(?:${AFFIRM}[\\s,.!]*)?${VERB}\\b` +
  `|${AFFIRM}[\\s,.!]+${ZAPIS}\\b(?![^\\n]*\\b(?:ale|oprav|počkej|pockej|ne)\\b)` +
  `|(?:${ZAPIS}(?:\\s+to)?|${AFFIRM})(?=\\s*[.!]*\\s*$)` +
  ")";

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

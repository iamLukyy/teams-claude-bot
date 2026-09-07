import dotenv from "dotenv";
import { randomBytes } from "crypto";
import { homedir } from "os";
import { resolve, dirname } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { CANONICAL_ENV_PATH, HANDOFF_TOKEN_PATH } from "./paths.js";
import { DEFAULT_UNLOCK_PATTERN } from "./bot/unlock.js";

// Load config: env vars (highest) > cwd/.env (repo dev) > canonical (npm/setup)
dotenv.config();
dotenv.config({ path: CANONICAL_ENV_PATH });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\"))
    return resolve(homedir(), p.slice(2));
  return resolve(p);
}

function parseAllowedUsers(raw?: string): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function parseCsvList(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}

function parseCsvSet(raw?: string): Set<string> {
  return new Set(parseCsvList(raw) ?? []);
}

function persistHandoffToken(token: string): void {
  try {
    mkdirSync(dirname(HANDOFF_TOKEN_PATH), { recursive: true });
    // Skip write if file already has the same token
    if (existsSync(HANDOFF_TOKEN_PATH)) {
      const existing = readFileSync(HANDOFF_TOKEN_PATH, "utf-8").trim();
      if (existing === token) return;
    }
    writeFileSync(HANDOFF_TOKEN_PATH, token, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    /* best-effort */
  }
}

export const config = {
  microsoftAppId: required("MICROSOFT_APP_ID"),
  microsoftAppPassword: required("MICROSOFT_APP_PASSWORD"),
  microsoftAppTenantId: required("MICROSOFT_APP_TENANT_ID"),
  port: parseInt(process.env.PORT ?? "3978", 10),
  claudeWorkDir: (() => {
    const dir = expandHome(required("CLAUDE_WORK_DIR"));
    if (!existsSync(dir)) {
      throw new Error(`CLAUDE_WORK_DIR does not exist: ${dir}`);
    }
    return dir;
  })(),
  allowedUsers: parseAllowedUsers(process.env.ALLOWED_USERS),
  handoffToken: (() => {
    const token = process.env.HANDOFF_TOKEN;
    if (token) {
      persistHandoffToken(token);
      return token;
    }
    // Try canonical file before generating a new one
    try {
      if (existsSync(HANDOFF_TOKEN_PATH)) {
        const saved = readFileSync(HANDOFF_TOKEN_PATH, "utf-8").trim();
        if (saved) return saved;
      }
    } catch {
      /* ignore */
    }
    // Auto-generate and persist to canonical file only
    const generated = randomBytes(32).toString("hex");
    persistHandoffToken(generated);
    return generated;
  })(),
  sessionInitPrompt: process.env.SESSION_INIT_PROMPT,
  defaultPermissionMode: process.env.PERMISSION_MODE ?? "default",
  /** Tools Claude may use without asking (CSV). Empty = SDK default (read-only set). */
  allowedTools: parseCsvList(process.env.ALLOWED_TOOLS),
  /** Teams conversation IDs the bot serves (CSV). Empty = any conversation. */
  allowedConversations: parseCsvSet(process.env.ALLOWED_CONVERSATIONS),
  /** Hours without messages after which the Claude session is closed and the next message starts fresh. 0 = never. */
  sessionIdleHours: Number.parseFloat(process.env.SESSION_IDLE_HOURS ?? "12") || 0,
  /** Default Claude model for new sessions (alias like "opus" or a full model id). */
  defaultModel: process.env.DEFAULT_MODEL ?? "opus",
  /** Unlock file for the checker's caflou-write-guard hook. Unset = feature off. */
  writeUnlockFile: process.env.WRITE_UNLOCK_FILE || undefined,
  /** Message pattern (case-insensitive) that opens the write window for one turn. */
  writeUnlockPattern: new RegExp(process.env.WRITE_UNLOCK_PATTERN ?? DEFAULT_UNLOCK_PATTERN, "i"),
  /** Safety net: the window closes after this many minutes even if the turn hangs. */
  writeUnlockTtlMin: Number.parseFloat(process.env.WRITE_UNLOCK_TTL_MIN ?? "15") || 15,
} as const;

// Map existing env vars for Teams SDK (SDK reads CLIENT_ID/CLIENT_SECRET/TENANT_ID)
process.env.CLIENT_ID = config.microsoftAppId;
process.env.CLIENT_SECRET = config.microsoftAppPassword;
process.env.TENANT_ID = config.microsoftAppTenantId;

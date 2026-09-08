import type { ClaudeResult, ProgressEvent } from "./agent.js";

const MAX_MESSAGE_LENGTH = 25_000;

// ─── Code-block language mapping ─────────────────────────────────────────

export const EXT_LANG_OVERRIDE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  mjs: "javascript",
  py: "python",
  sh: "bash",
  zsh: "bash",
  cs: "csharp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  htm: "html",
  ps1: "powershell",
  kt: "kotlin",
  tex: "latex",
  yml: "yaml",
  m: "objective-c",
  mm: "objective-c",
  vb: "vb.net",
  vbs: "vbscript",
  v: "verilog",
  vhd: "vhdl",
  md: "markdown",
};

export function codeBlockLanguage(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return "plaintext";
  const ext = filePath.slice(dot + 1).toLowerCase();
  return EXT_LANG_OVERRIDE[ext] ?? ext;
}

export function truncateProgress(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function formatProgressMessage(
  event: ProgressEvent,
): string | undefined {
  if (event.type === "tool_summary") {
    return `📋 ${truncateProgress(event.summary, 200)}`;
  }
  if (event.type === "task_status") {
    const icon =
      event.status === "started"
        ? "🚀"
        : event.status === "completed"
          ? "✅"
          : event.status === "in_progress"
            ? "🔧"
            : "⚠️";
    return `${icon} Task: ${truncateProgress(event.summary, 150)}`;
  }
  if (event.type !== "tool_use") return undefined;
  const tool = event.tool;
  if (tool.name === "Bash") {
    return `🔧 Running: ${truncateProgress(tool.command ?? "bash", 100)}`;
  }
  if (tool.name === "Grep") {
    return `🔎 Searching: ${truncateProgress(tool.pattern ?? "pattern", 100)}`;
  }
  if (tool.name === "Read") {
    return tool.file
      ? `📖 Reading: ${truncateProgress(tool.file, 100)}`
      : "📖 Reading file...";
  }
  if (tool.name === "Edit") {
    return tool.file
      ? `✍️ Editing: ${truncateProgress(tool.file, 100)}`
      : "✍️ Editing file...";
  }
  if (tool.name === "Write") {
    return tool.file
      ? `✍️ Writing: ${truncateProgress(tool.file, 100)}`
      : "✍️ Writing file...";
  }
  return `🔧 Running: ${tool.name}`;
}

export function formatResponse(result: ClaudeResult): string {
  return result.result || "Done (no output)";
}

export function splitMessage(
  text: string,
  maxLen = MAX_MESSAGE_LENGTH,
): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt === -1) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n+/, "");
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

// ─── Teams markdown normalizer ───────────────────────────────────────────
// Teams renders a markdown subset and is strict about block boundaries. Four
// things broke readability in production: a table glued to the intro sentence
// ("Podle klienta: | Klient | …") is not recognised as a table and collapses
// into one long line; headings/lists/tables without a blank line before them
// merge into the previous paragraph; "•" is not a markdown list marker, so
// such lines render flat, with no indent (the model reliably writes "•");
// and Teams gives consecutive paragraphs no vertical gap at all, so a correct
// "\n\n" still reads as a wall of text — only a line holding &nbsp; shows up
// as real empty space. This keeps the model's content and fixes presentation.
export function normalizeTeamsMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inCode = false;
  const isTable = (l: string) => /^\s*\|/.test(l);
  const isListItem = (l: string) => /^\s*([-*•]\s|\d+[.)]\s)/.test(l);
  const isBlockStart = (l: string) =>
    isListItem(l) || /^\s*(#{1,6}\s|(-{3,}|\*{3,}|_{3,})\s*$)/.test(l);
  const last = () => (out.length ? out[out.length - 1] : "");

  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      inCode = !inCode;
      out.push(raw);
      continue;
    }
    if (inCode) {
      out.push(raw);
      continue;
    }
    // "• náklad" is not a list to Teams — make it one ("- náklad")
    let line = raw.replace(/^(\s*)[•·‣▪]\s+/, "$1- ");

    // "Intro text: | a | b |" → intro on its own line, table starts fresh
    const emb = line.match(/^(\s*[^|]*?[^\s|])\s+(\|[^|\n]*\|.*)$/);
    if (emb && !isTable(line) && (emb[2].match(/\|/g) ?? []).length >= 3) {
      out.push(emb[1]);
      out.push("");
      line = emb[2];
    }

    const prev = last();
    const prevBlank = prev.trim() === "";
    const plain = line.trim() !== "" && !isTable(line) && !isBlockStart(line);
    if (isTable(line) && !prevBlank && !isTable(prev)) out.push("");
    else if (isBlockStart(line) && !prevBlank && !isBlockStart(prev) && !isTable(prev)) out.push("");
    // plain text right after a table or a list item would merge into it (lazy continuation)
    else if (plain && (isTable(prev) || isListItem(prev))) out.push("");

    out.push(line);
  }
  return addParagraphSpacers(
    out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd(),
  );
}

// Teams collapses the gap between two paragraphs, so a blank line is invisible.
// A line holding only &nbsp; is the one separator it renders as real space.
// Only between plain paragraphs — lists, tables, headings and code fences
// bring their own margins, and a spacer there would just add noise.
function addParagraphSpacers(text: string): string {
  const lines = text.split("\n");
  const isStructural = (l: string) =>
    /^\s*(\||#{1,6}\s|[-*+]\s|\d+[.)]\s|```|>|(-{3,}|\*{3,}|_{3,})\s*$)/.test(l);
  const out: string[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inCode = !inCode;

    if (!inCode && line.trim() === "") {
      const prev = out.length ? out[out.length - 1] : "";
      const next = lines[i + 1] ?? "";
      const gap =
        prev.trim() !== "" &&
        next.trim() !== "" &&
        !isStructural(prev) &&
        !isStructural(next);
      if (gap) {
        out.push("", "&nbsp;");
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Access control helpers — pure functions (unit-tested in tests/access.test.ts).
 *
 * Users are matched ONLY by Microsoft Entra object ID (never by display name —
 * names are user-editable). Conversations are matched by Teams conversation id.
 * An empty allowlist means "allow everyone" so a fresh install can bootstrap;
 * production config must set both ALLOWED_USERS and ALLOWED_CONVERSATIONS.
 */

export function isAadAllowed(
  aadObjectId: string | undefined,
  allowed: Set<string>,
): boolean {
  if (allowed.size === 0) return true;
  if (!aadObjectId) return false;
  return allowed.has(aadObjectId.toLowerCase());
}

export function isConversationAllowed(
  conversationId: string | undefined,
  allowed: Set<string>,
): boolean {
  if (allowed.size === 0) return true;
  if (!conversationId) return false;
  return allowed.has(conversationId);
}

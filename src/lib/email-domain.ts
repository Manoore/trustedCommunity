/**
 * `student@my.utdallas.edu` and `student@utdallas.edu` both belong to
 * `utdallas.edu`; `student@notutdallas.edu` and `student@utdallas.edu.evil.com`
 * do not. Kept apart from `edu.ts` (which is server-only) so the rule can be
 * tested directly - it is the one thing standing between a stranger and a
 * college's verified community.
 */
export function emailMatchesDomain(email: string, domain: string): boolean {
  const lower = email.trim().toLowerCase();
  const d = domain.trim().toLowerCase();
  if (!d || !lower.includes("@")) return false;

  // Exactly one "@": "a@b@utdallas.edu" is not a student address.
  if (lower.split("@").length !== 2) return false;

  const host = lower.slice(lower.lastIndexOf("@") + 1);
  return host === d || host.endsWith(`.${d}`);
}

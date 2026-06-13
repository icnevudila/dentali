const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidInviteEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254
}

export const BLOCKED_INVITE_ROLES = new Set(["owner"])

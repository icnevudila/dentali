const AVATAR_TONES = [
  "bg-primary-50 text-primary-700 ring-primary-100/80",
  "bg-emerald-50 text-emerald-700 ring-emerald-100/80",
  "bg-sky-50 text-sky-700 ring-sky-100/80",
  "bg-violet-50 text-violet-700 ring-violet-100/80",
] as const

export function avatarToneClass(initials: string): string {
  const a = initials.charCodeAt(0) || 0
  const b = initials.charCodeAt(1) || 0
  return AVATAR_TONES[(a + b) % AVATAR_TONES.length]
}

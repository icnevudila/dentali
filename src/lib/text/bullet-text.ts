/** Normalize multiline text into bullet-friendly lines for display/print. */
export function formatBulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[•\-*]\s*/, "").trim())
    .filter(Boolean)
}

export function insertBulletAtCursor(value: string, start: number, end: number): string {
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)
  const lineStart = before.lastIndexOf("\n") + 1
  const prefix = before.slice(lineStart)
  const needsNewline = before.length > 0 && !before.endsWith("\n")
  const bulletLine = selected
    ? selected
        .split(/\r?\n/)
        .map((l) => `• ${l.replace(/^\s*[•\-*]\s*/, "")}`)
        .join("\n")
    : "• "
  const insert = `${needsNewline ? "\n" : ""}${prefix ? "" : ""}${bulletLine}`
  return before.slice(0, lineStart) + (prefix && !prefix.endsWith("\n") ? "\n" : "") + bulletLine + after
}

export function renderBulletHtml(text: string): string {
  const lines = formatBulletLines(text)
  if (lines.length === 0) return ""
  return `<ul style="margin:0;padding-left:1.25rem">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

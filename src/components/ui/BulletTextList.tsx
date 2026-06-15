import { formatBulletLines } from "@/lib/text/bullet-text"
import { cn } from "@/lib/utils"

/** Read-only multiline / bullet text for tables and summaries. */
export function BulletTextList({
  text,
  empty = "—",
  className,
}: {
  text: string | null | undefined
  empty?: string
  className?: string
}) {
  const lines = text ? formatBulletLines(text) : []
  if (lines.length === 0) {
    return <span className={cn("text-neutral-400", className)}>{empty}</span>
  }
  if (lines.length === 1) {
    return <span className={cn("whitespace-pre-wrap", className)}>{lines[0]}</span>
  }
  return (
    <ul className={cn("list-disc space-y-0.5 pl-4 text-inherit", className)}>
      {lines.map((line, i) => (
        <li key={i} className="whitespace-pre-wrap">
          {line}
        </li>
      ))}
    </ul>
  )
}

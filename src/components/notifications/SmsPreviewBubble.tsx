import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

type SmsPreviewBubbleProps = {
  body: string
  label?: string
  sender?: string
  className?: string
}

export function SmsPreviewBubble({
  body,
  label,
  sender = "Smile Dental QC",
  className,
}: SmsPreviewBubbleProps) {
  return (
    <div className={cn("rounded-xl border border-neutral-200/80 bg-neutral-50/90 p-4", className)}>
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-neutral-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-primary-600">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        </span>
        {label ?? "SMS preview"}
      </div>

      <div className="mx-auto max-w-[280px] rounded-2xl border border-neutral-300/80 bg-neutral-100/90 p-3 shadow-inner">
        <div className="mb-3 flex items-center justify-center">
          <span className="h-1 w-10 rounded-full bg-neutral-300/90" aria-hidden />
        </div>
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400">
          Messages
        </p>
        <div className="relative max-w-[92%]">
          <div className="rounded-2xl rounded-tl-md border border-primary-100/90 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-neutral-800 shadow-sm">
            {body.trim() ? (
              <p className="whitespace-pre-wrap">{body}</p>
            ) : (
              <p className="text-neutral-400 italic">Message preview will appear here…</p>
            )}
          </div>
          <div
            className="absolute -left-1 top-3 h-2.5 w-2.5 rotate-45 border-b border-l border-primary-100/90 bg-white"
            aria-hidden
          />
        </div>
        <p className="mt-2 pl-1 text-[10px] text-neutral-400">
          {sender} · now
        </p>
      </div>
    </div>
  )
}

type VariableChipsProps = {
  variables: string[]
  onInsert?: (variable: string) => void
  className?: string
}

export function VariableChips({ variables, onInsert, className }: VariableChipsProps) {
  if (variables.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {variables.map((v) => {
        const token = `{{${v}}}`
        if (onInsert) {
          return (
            <button
              key={v}
              type="button"
              onClick={() => onInsert(token)}
              className="rounded-full border border-primary-100 bg-primary-50/50 px-2.5 py-1 font-mono text-[11px] text-primary-800 transition-colors hover:border-primary-200 hover:bg-primary-50"
            >
              {token}
            </button>
          )
        }
        return (
          <span
            key={v}
            className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-mono text-[11px] text-neutral-600"
          >
            {token}
          </span>
        )
      })}
    </div>
  )
}

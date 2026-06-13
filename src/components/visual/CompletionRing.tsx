import { cn } from "@/lib/utils"

export function CompletionRing({
  value,
  max = 100,
  size = 40,
  strokeWidth = 3,
  label,
  className,
}: {
  /** 0–max or 0–100 when max is 100 */
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  const tone =
    pct >= 100 ? "text-emerald-500" : pct >= 60 ? "text-primary-500" : pct >= 30 ? "text-amber-500" : "text-neutral-300"

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${pct}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-[stroke-dashoffset] duration-500", tone)}
        />
      </svg>
      <span
        className="absolute text-[10px] font-semibold tabular-nums text-neutral-700"
        aria-hidden
      >
        {pct}%
      </span>
    </div>
  )
}

import { cn } from "@/lib/utils"

type AuthClinicIllustrationProps = {
  compact?: boolean
  className?: string
}

/** Decorative clinic dashboard mockup for the auth marketing panel. */
export function AuthClinicIllustration({ compact = false, className }: AuthClinicIllustrationProps) {
  return (
    <div
      className={cn(
        "relative w-full",
        compact ? "mx-auto mt-0 max-w-[260px]" : "mt-8 max-w-[300px] xl:max-w-[320px]",
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          "rounded-2xl border border-neutral-200/80 bg-white shadow-[0_20px_40px_-16px_rgba(15,23,42,0.12)]",
          compact ? "p-2" : "p-2.5"
        )}
      >
        <div className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f57]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#febc2e]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#28c840]" />
            <span className="ml-1 h-1 flex-1 max-w-[72px] rounded-full bg-neutral-200" />
          </div>
          <div className={cn("flex", compact ? "h-[96px]" : "h-[148px]")}>
            <div className="flex w-9 shrink-0 flex-col gap-1.5 border-r border-neutral-100 bg-gradient-to-b from-primary-600 to-teal-700 p-1.5 sm:w-11 sm:gap-2 sm:p-2">
              <span className="h-1.5 w-1.5 rounded-sm bg-white/90 sm:h-2 sm:w-2" />
              <span className="h-1.5 w-1.5 rounded-sm bg-white/40 sm:h-2 sm:w-2" />
              <span className="mt-auto h-1.5 w-1.5 rounded-sm bg-white/30 sm:h-2 sm:w-2" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2 sm:gap-2 sm:p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="h-1.5 w-14 rounded-full bg-neutral-200 sm:h-2 sm:w-16" />
                <span className="h-3 w-8 rounded-md bg-primary-100 sm:h-4 sm:w-10" />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <span className="h-6 rounded-md bg-teal-50 ring-1 ring-teal-100 sm:h-8" />
                <span className="h-6 rounded-md bg-neutral-50 ring-1 ring-neutral-100 sm:h-8" />
                <span className="h-6 rounded-md bg-neutral-50 ring-1 ring-neutral-100 sm:h-8" />
              </div>
              <div className="space-y-1">
                <span className="block h-1.5 w-full rounded-full bg-neutral-100 sm:h-2" />
                <span className="block h-1.5 w-[88%] rounded-full bg-neutral-100 sm:h-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {!compact ? (
        <div className="absolute -bottom-3 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-md ring-1 ring-black/5">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-600" fill="currentColor" aria-hidden>
            <path d="M12 2C9.5 2 7.6 3.8 7.1 6.2 5.4 6.6 4 8.2 4 10.2 4 12.7 6 14.7 8.5 14.7c.3 0 .6 0 .9-.1.6 1.5 2 2.6 3.6 2.6s3-1.1 3.6-2.6c.3.1.6.1.9.1 2.5 0 4.5-2 4.5-4.5 0-2-1.4-3.6-3.1-4-.5-2.4-2.4-4.2-4.9-4.2z" />
          </svg>
        </div>
      ) : null}
    </div>
  )
}

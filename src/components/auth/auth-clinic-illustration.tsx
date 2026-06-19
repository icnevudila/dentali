/** Decorative clinic dashboard mockup for the auth marketing panel. */
export function AuthClinicIllustration() {
  return (
    <div className="relative mt-8 w-full max-w-[300px] xl:max-w-[320px]" aria-hidden>
      <div className="rounded-2xl border border-white/15 bg-white/10 p-2.5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
          <div className="flex items-center gap-1.5 border-b border-neutral-100 bg-neutral-50 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
            <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
            <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            <span className="ml-1 h-1.5 flex-1 max-w-[88px] rounded-full bg-neutral-200" />
          </div>
          <div className="flex h-[148px]">
            <div className="flex w-11 shrink-0 flex-col gap-2 border-r border-neutral-100 bg-gradient-to-b from-primary-600 to-teal-700 p-2">
              <span className="h-2 w-2 rounded-sm bg-white/90" />
              <span className="h-2 w-2 rounded-sm bg-white/40" />
              <span className="h-2 w-2 rounded-sm bg-white/40" />
              <span className="mt-auto h-2 w-2 rounded-sm bg-white/30" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="h-2 w-16 rounded-full bg-neutral-200" />
                <span className="h-4 w-10 rounded-md bg-primary-100" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <span className="h-8 rounded-md bg-teal-50 ring-1 ring-teal-100" />
                <span className="h-8 rounded-md bg-neutral-50 ring-1 ring-neutral-100" />
                <span className="h-8 rounded-md bg-neutral-50 ring-1 ring-neutral-100" />
              </div>
              <div className="space-y-1.5">
                <span className="block h-2 w-full rounded-full bg-neutral-100" />
                <span className="block h-2 w-[88%] rounded-full bg-neutral-100" />
                <span className="block h-2 w-[72%] rounded-full bg-neutral-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-3 -right-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white shadow-lg">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary-600" fill="currentColor" aria-hidden>
          <path d="M12 2C9.5 2 7.6 3.8 7.1 6.2 5.4 6.6 4 8.2 4 10.2 4 12.7 6 14.7 8.5 14.7c.3 0 .6 0 .9-.1.6 1.5 2 2.6 3.6 2.6s3-1.1 3.6-2.6c.3.1.6.1.9.1 2.5 0 4.5-2 4.5-4.5 0-2-1.4-3.6-3.1-4-.5-2.4-2.4-4.2-4.9-4.2z" />
        </svg>
      </div>
    </div>
  )
}

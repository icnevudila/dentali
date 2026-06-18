import { Suspense } from "react"

export default function PdaPrintLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="pda-print-route p-8 text-sm text-neutral-600">Loading…</div>}>{children}</Suspense>
}

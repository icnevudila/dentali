import { Suspense } from "react"
import { BranchBootstrap } from "@/components/layout/BranchBootstrap"

export default function PrintRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <BranchBootstrap>
      <Suspense fallback={<div className="pda-print-route p-8 text-sm text-neutral-600">Loading…</div>}>
        {children}
      </Suspense>
    </BranchBootstrap>
  )
}

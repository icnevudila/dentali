import type { ReactNode } from "react"

export default function PdaLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-neutral-50">{children}</div>
}

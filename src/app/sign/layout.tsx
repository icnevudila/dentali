import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"
import { DentQLLogo } from "@/components/brand/dentql-logo"

export const metadata: Metadata = {
  title: "Sign consent",
  robots: { index: false, follow: false },
}

export default function SignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200/80 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <DentQLLogo href="/welcome" size="sm" />
          <p className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-primary-500" aria-hidden />
            Secure consent signing
          </p>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-neutral-200 bg-white px-4 py-6 text-center text-xs text-neutral-500">
        Your signature is encrypted and stored with your clinic record.
      </footer>
    </div>
  )
}

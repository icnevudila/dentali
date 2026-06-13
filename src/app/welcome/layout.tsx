import Link from "next/link"
import type { Metadata } from "next"
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Dental clinic software for the Philippines",
  description:
    "Run your Metro Manila clinic on one system — appointments, dental chart, billing, HMO, queue display, kiosk check-in, and digital consent.",
  alternates: {
    canonical: `${siteUrl}/welcome`,
  },
  openGraph: {
    title: "dentali. — Philippine dental clinic OS",
    description:
      "Patients, appointments, charting, billing, queue, and HMO — branch-aware from the first login.",
    url: `${siteUrl}/welcome`,
  },
  keywords: [
    "dental clinic software Philippines",
    "dental practice management",
    "clinic queue system",
    "dental chart software",
    "HMO dental billing",
  ],
}

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/welcome" className="text-lg font-bold tracking-tight text-neutral-950">
            dentali<span className="text-primary-600">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              href="/login"
              className="text-sm font-medium text-primary-700 hover:text-primary-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        dentali. — clinical operating system
      </footer>
    </div>
  )
}

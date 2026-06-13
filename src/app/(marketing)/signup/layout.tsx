import type { Metadata } from "next"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your dentali. clinic account — free trial with full clinical workflow.",
  alternates: { canonical: `${siteUrl}/signup` },
  openGraph: {
    title: "Start free trial — dentali.",
    description: "Register your clinic and complete onboarding in minutes.",
    url: `${siteUrl}/signup`,
  },
  robots: { index: true, follow: true },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}

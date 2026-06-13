import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col">
      <OnboardingHeader />
      <main className="flex-1 flex items-center justify-center p-6">{children}</main>
    </div>
  )
}

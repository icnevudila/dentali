import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

export default function CheckInLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
      <PageLoadingSkeleton variant="compact" />
    </main>
  )
}

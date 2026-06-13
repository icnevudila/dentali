import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

export default function KioskLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <PageLoadingSkeleton variant="form" className="max-w-lg w-full" />
    </div>
  )
}

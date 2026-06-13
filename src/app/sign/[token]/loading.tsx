import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

export default function PublicSignLoading() {
  return (
    <div className="flex items-center justify-center px-4 py-16">
      <PageLoadingSkeleton variant="consent" className="max-w-2xl w-full" />
    </div>
  )
}

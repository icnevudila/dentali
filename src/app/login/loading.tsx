import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <PageLoadingSkeleton variant="form" className="max-w-md w-full" />
    </div>
  )
}

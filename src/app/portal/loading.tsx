import { Loader2 } from "lucide-react"

export default function PortalLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
      <Loader2 className="h-10 w-10 animate-spin text-primary-500" aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  )
}

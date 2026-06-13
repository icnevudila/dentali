import { Loader2 } from "lucide-react"

export default function DisplayLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <Loader2 className="h-16 w-16 animate-spin text-primary-600" />
    </div>
  )
}

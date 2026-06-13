import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContentPanel } from "@/components/layout/ContentPanel"

type RouteNotFoundProps = {
  title?: string
  description?: string
  homeHref?: string
  homeLabel?: string
}

export function RouteNotFound({
  title = "Page not found",
  description = "This page does not exist or may have been moved. Check the URL or return to a known area of the app.",
  homeHref = "/",
  homeLabel = "Back to dashboard",
}: RouteNotFoundProps) {
  return (
    <div className="mx-auto w-full max-w-lg animate-page-enter py-8 px-4">
      <ContentPanel className="py-10 text-center">
        <FileQuestion className="mx-auto h-10 w-10 text-neutral-400" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-neutral-950">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{description}</p>
        <div className="mt-6">
          <Button asChild>
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        </div>
      </ContentPanel>
    </div>
  )
}

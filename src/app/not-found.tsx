import { RouteNotFound } from "@/components/layout/RouteNotFound"

export default function RootNotFound() {
  return (
    <RouteNotFound
      title="Page not found"
      description="The page you requested is not part of dentali. Return to the app or welcome page."
      homeHref="/welcome"
      homeLabel="Go to dentali."
    />
  )
}

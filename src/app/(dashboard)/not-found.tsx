import { RouteNotFound } from "@/components/layout/RouteNotFound"

export default function DashboardNotFound() {
  return (
    <RouteNotFound
      title="Module page not found"
      description="This dashboard route does not exist. Use the sidebar to navigate to a valid module."
      homeHref="/"
      homeLabel="Back to dashboard"
    />
  )
}

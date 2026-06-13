import { RouteNotFound } from "@/components/layout/RouteNotFound"

export default function PatientsNotFound() {
  return (
    <RouteNotFound
      title="Patient page not found"
      description="This patient record or sub-page could not be found. The patient may have been archived or the link is outdated."
      homeHref="/patients"
      homeLabel="Back to patient registry"
    />
  )
}

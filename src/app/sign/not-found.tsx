import { RouteNotFound } from "@/components/layout/RouteNotFound"

export default function SignNotFound() {
  return (
    <RouteNotFound
      title="Signing link not found"
      description="This consent signing URL does not exist. Ask your clinic to send a new link."
      homeHref="/welcome"
      homeLabel="Back to home"
    />
  )
}

import { RouteNotFound } from "@/components/layout/RouteNotFound"

export default function BillingNotFound() {
  return (
    <RouteNotFound
      title="Billing page not found"
      description="This invoice or billing route does not exist. Return to the billing hub to find active claims and invoices."
      homeHref="/billing"
      homeLabel="Back to billing"
    />
  )
}

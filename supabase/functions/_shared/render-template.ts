export function renderNotificationBody(
  template: string,
  vars: Record<string, string>
): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

export function formatPhpCurrency(amount: number): string {
  return `₱${Number(amount ?? 0).toLocaleString("en-PH")}`
}

export type CloseoutPayload = {
  date?: string
  collected?: number
  open_balance?: number
  open_invoice_count?: number
  appointments_completed?: number
  no_show?: number
  pending_consents?: number
  hmo_pending?: number
  low_stock?: number
}

export function closeoutVarsFromPayload(
  clinicName: string,
  payload: CloseoutPayload
): Record<string, string> {
  return {
    clinic_name: clinicName,
    date: String(payload.date ?? ""),
    collected: formatPhpCurrency(Number(payload.collected ?? 0)),
    open_balance: formatPhpCurrency(Number(payload.open_balance ?? 0)),
    appointments_completed: String(payload.appointments_completed ?? 0),
    no_show: String(payload.no_show ?? 0),
    open_invoice_count: String(payload.open_invoice_count ?? 0),
    pending_consents: String(payload.pending_consents ?? 0),
    hmo_pending: String(payload.hmo_pending ?? 0),
    low_stock: String(payload.low_stock ?? 0),
  }
}

export function resolveSiteUrl(): string {
  return (
    Deno.env.get("SITE_URL") ??
    Deno.env.get("NEXT_PUBLIC_SITE_URL") ??
    "https://ph-dental-app.vercel.app"
  ).replace(/\/$/, "")
}

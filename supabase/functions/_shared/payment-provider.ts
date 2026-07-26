export type PaymentProviderName = "gcash" | "paymongo"

export type PaymentCheckoutResult =
  | {
      ok: true
      mode: "live" | "stub"
      externalRef: string
      checkoutUrl: string
    }
  | { ok: false; error: string }

/**
 * Create a checkout session.
 *
 * `amount` is PHP **major units (pesos)** as stored/compared on invoices in the app
 * ledger UI (e.g. 1500.5 = ₱1,500.50). PayMongo line_items.amount must be
 * **centavos** (minor units), so we convert with ×100.
 */
export async function createPaymentCheckout(params: {
  provider: PaymentProviderName
  /** Invoice balance / pay amount in pesos (major units). */
  amount: number
  invoiceId: string
  externalRefSeed: string
}): Promise<PaymentCheckoutResult> {
  const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY")
  const siteUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? ""

  if (params.provider === "paymongo" && paymongoKey) {
    try {
      // Pesos → centavos for PayMongo. Reject non-finite / sub-centavo noise.
      const amountCentavos = Math.round(Number(params.amount) * 100)
      if (!Number.isFinite(amountCentavos) || amountCentavos < 100) {
        return { ok: false, error: "Amount must be at least ₱1.00" }
      }

      const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${paymongoKey}:`)}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              line_items: [
                {
                  amount: amountCentavos,
                  currency: "PHP",
                  name: `Invoice ${params.invoiceId.slice(0, 8)}`,
                  quantity: 1,
                },
              ],
              payment_method_types: ["gcash", "card", "paymaya"],
              success_url: siteUrl ? `${siteUrl}/billing/${params.invoiceId}` : undefined,
              cancel_url: siteUrl ? `${siteUrl}/billing/${params.invoiceId}` : undefined,
              description: `Dental invoice ${params.externalRefSeed}`,
            },
          },
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        const errMsg =
          typeof json === "object" && json !== null && "errors" in json
            ? JSON.stringify((json as { errors: unknown }).errors)
            : "PayMongo checkout failed"
        return { ok: false, error: errMsg }
      }

      const attrs = (json as { data?: { id?: string; attributes?: { checkout_url?: string } } }).data
      const checkoutUrl = attrs?.attributes?.checkout_url
      const sessionId = attrs?.id

      if (!checkoutUrl || !sessionId) {
        return { ok: false, error: "Invalid PayMongo response" }
      }

      return {
        ok: true,
        mode: "live",
        externalRef: sessionId,
        checkoutUrl,
      }
    } catch {
      return { ok: false, error: "PayMongo request failed" }
    }
  }

  const ref = `${params.provider.toUpperCase()}-${params.externalRefSeed}`
  const checkoutUrl = `https://checkout.stub.ph-dental.local/${params.provider}/${ref}`

  return {
    ok: true,
    mode: "stub",
    externalRef: ref,
    checkoutUrl,
  }
}

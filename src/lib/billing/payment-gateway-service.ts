import { createClient } from "@/lib/supabase/client"

export type PaymentProvider = "gcash" | "paymongo"

export interface PaymentIntent {
  id: string
  provider: PaymentProvider
  amount: number
  status: string
  external_ref: string
  checkout_url: string
  created_at?: string
}

export async function createPaymentIntent(params: {
  invoiceId: string
  provider: PaymentProvider
  amount: number
}): Promise<{ data: PaymentIntent | null; error: string | null; dryRun?: boolean }> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: {
      invoice_id: params.invoiceId,
      provider: params.provider,
      amount: params.amount,
    },
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, unknown>
  if (raw?.error) return { data: null, error: String(raw.error) }

  return {
    data: {
      id: String(raw.id),
      provider: raw.provider as PaymentProvider,
      amount: Number(raw.amount),
      status: String(raw.status ?? "pending"),
      external_ref: String(raw.external_ref),
      checkout_url: String(raw.checkout_url),
    },
    dryRun: raw.dry_run === true,
    error: null,
  }
}

export async function completePaymentIntent(
  intentId: string
): Promise<{ data: { paid_amount: number; status: string; balance: number } | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("complete_payment_intent", {
    p_intent_id: intentId,
  })

  if (error) return { data: null, error: error.message }
  const raw = data as Record<string, number>
  return {
    data: {
      paid_amount: Number(raw.paid_amount),
      status: String(raw.status),
      balance: Number(raw.balance),
    },
    error: null,
  }
}

export async function fetchPendingIntents(
  invoiceId: string
): Promise<{ data: PaymentIntent[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("payment_gateway_intents")
    .select("id, provider, amount, status, external_ref, checkout_url, created_at")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider as PaymentProvider,
      amount: Number(row.amount),
      status: row.status,
      external_ref: row.external_ref,
      checkout_url: row.checkout_url,
      created_at: row.created_at,
    })),
    error: null,
  }
}

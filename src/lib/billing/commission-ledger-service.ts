import { createClient } from "@/lib/supabase/client"
import { formatCentavosAsPhp, pesoMajorToCentavos } from "@/lib/money/php-money"

/**
 * Provider commission ledger rows (branch-scoped).
 * Amounts are peso major units from the payment RPC (`numeric`), not centavos.
 * RLS: billing.read | staff.manage | own provider_id — UI gates on billing.read.
 * Does not select or log patient identifiers.
 */
export type CommissionLedgerRow = {
  id: string
  provider_id: string
  provider_name: string
  invoice_id: string
  invoice_number: string | null
  /** Peso major (ledger/RPC numeric). */
  amount: number
  calculated_at: string
}

type CommissionRaw = {
  id: string
  provider_id: string
  invoice_id: string
  amount: number | string
  calculated_at: string | null
}

export async function listProviderCommissions(
  branchId: string,
  options?: { limit?: number }
): Promise<{ data: CommissionLedgerRow[]; error: string | null }> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200)

  if (!branchId) {
    return { data: [], error: "Branch is required" }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("provider_commissions")
    .select("id, provider_id, invoice_id, amount, calculated_at")
    .eq("branch_id", branchId)
    .order("calculated_at", { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = (data ?? []) as CommissionRaw[]
  if (rows.length === 0) {
    return { data: [], error: null }
  }

  const providerIds = [...new Set(rows.map((r) => r.provider_id).filter(Boolean))]
  const invoiceIds = [...new Set(rows.map((r) => r.invoice_id).filter(Boolean))]

  const [profilesRes, invoicesRes] = await Promise.all([
    providerIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email").in("id", providerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[], error: null }),
    invoiceIds.length > 0
      ? supabase.from("invoices").select("id, invoice_number").in("id", invoiceIds)
      : Promise.resolve({ data: [] as { id: string; invoice_number: string | null }[], error: null }),
  ])

  // Name/invoice enrichment failures must not hide ledger rows already returned by RLS.
  const nameById = new Map<string, string>()
  for (const profile of profilesRes.data ?? []) {
    nameById.set(profile.id, profile.full_name?.trim() || profile.email?.trim() || "Provider")
  }

  const invoiceById = new Map<string, string | null>()
  for (const inv of invoicesRes.data ?? []) {
    invoiceById.set(inv.id, inv.invoice_number)
  }

  return {
    data: rows.map((row) => ({
      id: row.id,
      provider_id: row.provider_id,
      provider_name: nameById.get(row.provider_id) ?? "Provider",
      invoice_id: row.invoice_id,
      invoice_number: invoiceById.get(row.invoice_id) ?? null,
      amount: Number(row.amount),
      calculated_at: row.calculated_at ?? "",
    })),
    error: null,
  }
}

export function commissionInvoiceLabel(
  row: Pick<CommissionLedgerRow, "invoice_number" | "invoice_id">
): string {
  return row.invoice_number?.trim() || row.invoice_id.slice(0, 8)
}

export function sumCommissionAmounts(
  rows: Array<Pick<CommissionLedgerRow, "amount">>
): number {
  return rows.reduce((sum, row) => sum + row.amount, 0)
}

/** Display helper — converts peso major → centavos for php-money formatters. */
export function formatCommissionPhp(pesoMajor: number, locale = "en-PH"): string {
  return formatCentavosAsPhp(pesoMajorToCentavos(pesoMajor), locale)
}

export const COMMISSION_LEDGER_HREF = "/billing/commissions"

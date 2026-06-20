import { createClient } from "@supabase/supabase-js"

export default async function globalSetup() {
  if (process.env.E2E_STRICT !== "true") return

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  const branchId = process.env.E2E_BRANCH_ID
  if (!url || !serviceKey || !branchId) {
    throw new Error("Strict staging E2E requires Supabase URL, service role key, and branch ID")
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await supabase.rpc("seed_demo_showcase_data", { p_branch_id: branchId })
  if (error) throw new Error(`Could not prepare staging fixtures: ${error.message}`)

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("organization_id")
    .eq("id", branchId)
    .single()
  if (branchError || !branch) throw new Error(`Staging branch verification failed: ${branchError?.message ?? "not found"}`)

  const { count, error: patientError } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", branch.organization_id)
  if (patientError || !count) throw new Error(`Staging fixture verification failed: ${patientError?.message ?? "no patients"}`)
}

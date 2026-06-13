import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { createPaymentCheckout, type PaymentProviderName } from "../_shared/payment-provider.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const invoiceId = String(body.invoice_id ?? "").trim()
    const provider = String(body.provider ?? "").trim() as PaymentProviderName
    const amount = Number(body.amount)

    if (!invoiceId || !provider || !amount) {
      return new Response(JSON.stringify({ error: "invoice_id, provider, and amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (provider !== "gcash" && provider !== "paymongo") {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: inv, error: invError } = await supabaseUser
      .from("invoices")
      .select("id, organization_id, branch_id, total_amount, paid_amount, status")
      .eq("id", invoiceId)
      .maybeSingle()

    if (invError || !inv) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "billing.write",
      p_branch: inv.branch_id,
    })

    if (permError || !allowed) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (inv.status === "void") {
      return new Response(JSON.stringify({ error: "Cannot pay void invoice" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const balance = Number(inv.total_amount) - Number(inv.paid_amount)
    if (amount <= 0 || amount > balance) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const refSeed = crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    const checkout = await createPaymentCheckout({
      provider,
      amount,
      invoiceId,
      externalRefSeed: refSeed,
    })

    if (!checkout.ok) {
      return new Response(JSON.stringify({ error: checkout.error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: intentRow, error: insertError } = await supabaseAdmin
      .from("payment_gateway_intents")
      .insert({
        organization_id: inv.organization_id,
        branch_id: inv.branch_id,
        invoice_id: invoiceId,
        provider,
        amount,
        external_ref: checkout.externalRef,
        checkout_url: checkout.checkoutUrl,
        created_by: user.id,
        metadata: { mode: checkout.mode },
      })
      .select("id")
      .single()

    if (insertError || !intentRow) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Failed to save intent" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        id: intentRow.id,
        provider,
        amount,
        status: "pending",
        external_ref: checkout.externalRef,
        checkout_url: checkout.checkoutUrl,
        mode: checkout.mode,
        dry_run: checkout.mode === "stub",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

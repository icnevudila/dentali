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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json()
    const sessionId = String(body.session_id ?? "").trim()
    const phone = String(body.phone ?? "").trim()
    const lastName = String(body.last_name ?? "").trim()
    const invoiceId = String(body.invoice_id ?? "").trim()
    const provider = String(body.provider ?? "paymongo").trim() as PaymentProviderName
    const amount = body.amount != null && body.amount !== "" ? Number(body.amount) : null

    if (!sessionId || !phone || !lastName || !invoiceId) {
      return new Response(
        JSON.stringify({ error: "session_id, phone, last_name, and invoice_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (provider !== "gcash" && provider !== "paymongo") {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: prep, error: prepError } = await supabaseAdmin.rpc("prepare_portal_payment_intent", {
      p_session_id: sessionId,
      p_phone: phone,
      p_last_name: lastName,
      p_invoice_id: invoiceId,
      p_provider: provider,
      p_amount: amount,
    })

    if (prepError || !prep) {
      return new Response(JSON.stringify({ error: prepError?.message ?? "Could not prepare payment" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const prepRaw = prep as Record<string, unknown>
    const intentId = String(prepRaw.intent_id)
    const prepAmount = Number(prepRaw.amount)
    const prepInvoiceId = String(prepRaw.invoice_id)
    const externalRefSeed = String(prepRaw.external_ref ?? "")
      .replace(/^portal-/, "")
      .slice(0, 12)

    const checkout = await createPaymentCheckout({
      provider,
      amount: prepAmount,
      invoiceId: prepInvoiceId,
      externalRefSeed: externalRefSeed || crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    })

    if (!checkout.ok) {
      return new Response(JSON.stringify({ error: checkout.error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { error: updateError } = await supabaseAdmin
      .from("payment_gateway_intents")
      .update({
        checkout_url: checkout.checkoutUrl,
        external_ref: checkout.externalRef,
        metadata: { mode: checkout.mode, portal: true },
      })
      .eq("id", intentId)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        id: intentId,
        checkout_url: checkout.checkoutUrl,
        amount: prepAmount,
        provider,
        external_ref: checkout.externalRef,
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paymongo-signature",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET")
    const rawBody = await req.text()

    if (webhookSecret) {
      const signature = req.headers.get("paymongo-signature")
      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      // PayMongo HMAC verification can be added when secret is configured in dashboard.
    }

    const payload = JSON.parse(rawBody) as {
      data?: {
        id?: string
        attributes?: {
          type?: string
          data?: { id?: string; attributes?: { type?: string } }
        }
      }
    }

    const eventType = payload?.data?.attributes?.type ?? ""
    const paidEvents = ["checkout_session.payment.paid", "payment.paid"]
    if (!paidEvents.some((t) => eventType.includes(t) || eventType === t)) {
      return new Response(JSON.stringify({ received: true, ignored: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const sessionId =
      payload?.data?.attributes?.data?.id ??
      payload?.data?.id ??
      null

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing checkout session id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data, error } = await supabaseAdmin.rpc("complete_payment_intent_by_ref", {
      p_external_ref: sessionId,
      p_provider: "paymongo",
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

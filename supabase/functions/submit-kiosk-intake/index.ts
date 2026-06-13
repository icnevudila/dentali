import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

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
    const payload = body.payload

    if (!sessionId || !payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "session_id and payload are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data, error } = await supabaseAdmin.rpc("submit_kiosk_intake", {
      p_session_id: sessionId,
      p_payload: payload,
    })

    if (error) {
      const safeMessage =
        error.message?.includes("expired") ||
        error.message?.includes("required") ||
        error.message?.includes("find")
          ? error.message
          : "Unable to submit intake"
      return new Response(JSON.stringify({ error: safeMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("submit-kiosk-intake error", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

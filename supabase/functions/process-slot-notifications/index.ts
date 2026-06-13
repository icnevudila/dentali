import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET")
    const headerSecret = req.headers.get("x-cron-secret")
    const authHeader = req.headers.get("Authorization") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!

    const authorized =
      (cronSecret && headerSecret === cronSecret) ||
      authHeader === `Bearer ${serviceRoleKey}`

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: pending, error } = await supabaseAdmin
      .from("slot_notification_queue")
      .select("id, branch_id, slot_at")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(20)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let processed = 0
    const errors: string[] = []

    for (const row of pending ?? []) {
      const notifyRes = await fetch(`${supabaseUrl}/functions/v1/notify-waitlist-slot`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branch_id: row.branch_id,
          slot_at: row.slot_at,
          limit: 3,
        }),
      })

      if (!notifyRes.ok) {
        const errText = await notifyRes.text()
        errors.push(`${row.id}: ${errText}`)
        continue
      }

      await supabaseAdmin
        .from("slot_notification_queue")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", row.id)

      processed += 1
    }

    return new Response(JSON.stringify({ processed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

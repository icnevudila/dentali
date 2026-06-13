import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { buildIntakePdf, pdfBytesToBase64 } from "../_shared/intake-pdf.ts"

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
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

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
    const intakeId = String(body.intake_id ?? "").trim()

    if (!intakeId) {
      return new Response(JSON.stringify({ error: "intake_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: intake, error: intakeError } = await supabaseUser
      .from("patient_intakes")
      .select("id, branch_id, status, payload, created_at")
      .eq("id", intakeId)
      .single()

    if (intakeError || !intake) {
      return new Response(JSON.stringify({ error: "Intake not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "patients.read",
      p_branch: intake.branch_id,
    })

    if (permError || !allowed) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const payload = intake.payload as Record<string, unknown>
    const pdfBytes = await buildIntakePdf({
      intakeId: intake.id,
      status: intake.status,
      createdAt: intake.created_at,
      payload,
    })

    return new Response(
      JSON.stringify({
        data: {
          intake_id: intake.id,
          format: "application/pdf",
          filename: `intake-${intake.id.slice(0, 8)}.pdf`,
          pdf_base64: pdfBytesToBase64(pdfBytes),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("generate-intake-pdf error", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

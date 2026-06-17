import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { sendOrgLiveSms } from "../_shared/provider-secrets.ts"
import { resolveBranchNotificationTemplate } from "../_shared/notification-template.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function renderBody(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

function formatManilaDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
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
    const appointmentId = String(body.appointment_id ?? "").trim()

    if (!appointmentId) {
      return new Response(JSON.stringify({ error: "appointment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, branch_id, organization_id, patient_id, scheduled_at, status, patients(first_name, last_name, phone), branches(name)"
      )
      .eq("id", appointmentId)
      .maybeSingle()

    if (apptError || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const branchId = appt.branch_id as string

    const { data: canNotify } = await supabaseUser.rpc("has_permission", {
      p_permission: "notifications.write",
      p_branch: branchId,
    })
    const { data: canApptWrite } = await supabaseUser.rpc("has_permission", {
      p_permission: "appointments.write",
      p_branch: branchId,
    })

    if (!canNotify && !canApptWrite) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!["scheduled", "confirmed"].includes(String(appt.status))) {
      return new Response(JSON.stringify({ error: "Appointment is not eligible for reminder" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients
    const branch = Array.isArray(appt.branches) ? appt.branches[0] : appt.branches
    const phone = String(patient?.phone ?? "").trim()

    if (!phone) {
      return new Response(JSON.stringify({ error: "Patient has no phone number on file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const template = await resolveBranchNotificationTemplate(
      supabaseAdmin,
      branchId,
      "appointment_reminder"
    )

    if (!template?.body) {
      return new Response(JSON.stringify({ error: "Appointment reminder template not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { date, time } = formatManilaDate(String(appt.scheduled_at))
    const patientName = [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") || "Patient"
    const messageBody = renderBody(template.body, {
      patient_name: patientName,
      clinic_name: String(branch?.name ?? "Clinic"),
      appointment_date: date,
      appointment_time: time,
    })

    const { data: branchSettings } = await supabaseAdmin
      .from("notification_branch_settings")
      .select("dry_run_mode")
      .eq("branch_id", branchId)
      .maybeSingle()

    const dryRun = branchSettings?.dry_run_mode ?? true
    let status = dryRun ? "dry_run" : "sent"
    let providerRef: string | null = null
    let errorMessage: string | null = null

    if (!dryRun) {
      const smsResult = await sendOrgLiveSms(supabaseAdmin, {
        organizationId: String(appt.organization_id),
        branchId,
        phone,
        message: messageBody,
      })
      if (smsResult.ok) {
        providerRef = smsResult.providerRef
      } else {
        status = "failed"
        errorMessage = smsResult.error
      }
    }

    const { data: logRow, error: insertError } = await supabaseAdmin
      .from("notification_logs")
      .insert({
        organization_id: appt.organization_id,
        branch_id: branchId,
        patient_id: appt.patient_id,
        template_id: template.id,
        template_key: "appointment_reminder",
        recipient_phone: phone,
        body_preview: messageBody.slice(0, 500),
        status,
        provider_ref: providerRef,
        error_message: errorMessage,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (status === "failed") {
      return new Response(
        JSON.stringify({
          error: errorMessage ?? "SMS send failed",
          log_id: logRow.id,
          status,
          appointment_id: appointmentId,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logRow.id,
        status,
        dry_run: dryRun,
        body_preview: messageBody.slice(0, 200),
        appointment_id: appointmentId,
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

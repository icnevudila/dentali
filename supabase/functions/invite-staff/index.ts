import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import {
  BLOCKED_INVITE_ROLES,
  isValidInviteEmail,
  normalizeInviteEmail,
} from "../_shared/invite-staff-utils.ts"

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
    const siteUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? ""

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
    const email = normalizeInviteEmail(String(body.email ?? ""))
    const fullName = String(body.full_name ?? "").trim()
    const branchId = body.branch_id as string
    const roleId = body.role_id as string

    if (!email || !branchId || !roleId) {
      return new Response(JSON.stringify({ error: "email, branch_id, and role_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!isValidInviteEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const inviterEmail = user.email ? normalizeInviteEmail(user.email) : null
    if (inviterEmail && inviterEmail === email) {
      return new Response(JSON.stringify({ error: "You cannot invite your own email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "staff.manage",
      p_branch: branchId,
    })

    if (permError || !allowed) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found for inviter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("id, organization_id, is_active")
      .eq("id", branchId)
      .maybeSingle()

    if (!branch || branch.organization_id !== profile.organization_id) {
      return new Response(JSON.stringify({ error: "Invalid branch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (branch.is_active === false) {
      return new Response(JSON.stringify({ error: "Cannot invite staff to an inactive branch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("id, name")
      .eq("id", roleId)
      .maybeSingle()

    if (!role) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (BLOCKED_INVITE_ROLES.has(role.name)) {
      return new Response(JSON.stringify({ error: "This role cannot be assigned via invitation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: existingMember } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .ilike("email", email)
      .maybeSingle()

    if (existingMember) {
      return new Response(JSON.stringify({ error: "This email already belongs to a staff member in your organization" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: pendingInvite } = await supabaseAdmin
      .from("staff_invitations")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending")
      .ilike("email", email)
      .maybeSingle()

    if (pendingInvite) {
      return new Response(JSON.stringify({ error: "A pending invitation already exists for this email" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: invitation, error: insertError } = await supabaseAdmin
      .from("staff_invitations")
      .insert({
        organization_id: profile.organization_id,
        branch_id: branchId,
        role_id: roleId,
        email,
        full_name: fullName || null,
        invited_by: user.id,
        status: "pending",
      })
      .select("id")
      .single()

    if (insertError || !invitation) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Failed to create invitation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { error: inviteAuthError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl ? `${siteUrl}/login` : undefined,
      data: {
        full_name: fullName,
        invited_to_org: profile.organization_id,
        invitation_id: invitation.id,
      },
    })

    if (inviteAuthError) {
      await supabaseAdmin.from("staff_invitations").delete().eq("id", invitation.id)

      const message =
        inviteAuthError.message.includes("already been registered") ||
        inviteAuthError.message.includes("already registered")
          ? "This email is already registered. Ask them to sign in, or use a different address."
          : inviteAuthError.message

      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    await supabaseAdmin.from("organization_audit_logs").insert({
      organization_id: profile.organization_id,
      branch_id: branchId,
      profile_id: user.id,
      action: "staff.invite",
      entity_type: "staff_invitation",
      entity_id: invitation.id,
      metadata: { email, role: role.name, branch_id: branchId },
    })

    return new Response(
      JSON.stringify({
        success: true,
        invitation_id: invitation.id,
        email,
        dry_run: false,
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const STAFF_SAFE = {
  unauthorized: "You need to sign in again to continue.",
  forbidden: "You do not have permission to import medical history for this branch.",
  badRequest: "That file could not be processed. Try a clearer photo of the form.",
  notConfigured:
    "Form reading is not configured yet. Ask an admin to add the OCR API key in Edge Function secrets.",
  providerFailed: "We could not read that form. Try again with a brighter, flatter photo.",
  pdfUnsupported:
    "PDF reading is limited in this version. Please upload a JPEG or PNG photo of the form.",
}

type Draft = {
  allergies: string[]
  medications: string[]
  conditions: string[]
  notes: string | null
  confidence: {
    overall: number
    allergies?: number
    medications?: number
    conditions?: number
    notes?: number
  }
  warnings: string[]
  source_storage_path: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 40)
}

function clamp01(n: unknown, fallback = 0.5): number {
  const x = typeof n === "number" ? n : Number(n)
  if (!Number.isFinite(x)) return fallback
  return Math.max(0, Math.min(1, x))
}

function parseDraft(raw: unknown, storagePath: string): Draft | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  const confidenceRaw =
    obj.confidence && typeof obj.confidence === "object"
      ? (obj.confidence as Record<string, unknown>)
      : {}
  const warnings = Array.isArray(obj.warnings)
    ? obj.warnings.map((w) => String(w)).filter(Boolean).slice(0, 10)
    : []

  return {
    allergies: asStringArray(obj.allergies),
    medications: asStringArray(obj.medications),
    conditions: asStringArray(obj.conditions),
    notes: obj.notes == null || obj.notes === "" ? null : String(obj.notes).slice(0, 2000),
    confidence: {
      overall: clamp01(confidenceRaw.overall, 0.5),
      allergies: confidenceRaw.allergies != null ? clamp01(confidenceRaw.allergies) : undefined,
      medications: confidenceRaw.medications != null ? clamp01(confidenceRaw.medications) : undefined,
      conditions: confidenceRaw.conditions != null ? clamp01(confidenceRaw.conditions) : undefined,
      notes: confidenceRaw.notes != null ? clamp01(confidenceRaw.notes) : undefined,
    },
    warnings,
    source_storage_path: storagePath,
  }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error("no_json")
  }
}

async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: STAFF_SAFE.unauthorized }, 401)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? ""
    const model = Deno.env.get("MEDICAL_HISTORY_OCR_MODEL")?.trim() || "gpt-4o-mini"

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return jsonResponse({ error: STAFF_SAFE.unauthorized }, 401)
    }

    const body = await req.json()
    const patientId = String(body.patient_id ?? "")
    const branchId = String(body.branch_id ?? "")
    const organizationId = String(body.organization_id ?? "")
    const storagePath = String(body.storage_path ?? "")

    if (!patientId || !branchId || !organizationId || !storagePath) {
      return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
    }

    if (!storagePath.startsWith(`${organizationId}/`)) {
      return jsonResponse({ error: STAFF_SAFE.forbidden }, 403)
    }

    const { data: allowed, error: permError } = await supabaseUser.rpc("has_permission", {
      p_permission: "patients.medical_history.write",
      p_branch: branchId,
    })

    if (permError || !allowed) {
      return jsonResponse({ error: STAFF_SAFE.forbidden }, 403)
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id || profile.organization_id !== organizationId) {
      return jsonResponse({ error: STAFF_SAFE.forbidden }, 403)
    }

    const { data: patient } = await supabaseUser
      .from("patients")
      .select("id, organization_id")
      .eq("id", patientId)
      .maybeSingle()

    if (!patient || patient.organization_id !== organizationId) {
      return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
    }

    if (!openaiKey) {
      return jsonResponse({ error: STAFF_SAFE.notConfigured }, 503)
    }

    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from("medical-history-imports")
      .download(storagePath)

    if (downloadError || !fileBlob) {
      return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
    }

    const contentType = fileBlob.type || "application/octet-stream"
    if (contentType === "application/pdf" || storagePath.toLowerCase().endsWith(".pdf")) {
      return jsonResponse({ error: STAFF_SAFE.pdfUnsupported }, 400)
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      // Some browsers omit type; allow by extension
      const lower = storagePath.toLowerCase()
      if (!lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".png") && !lower.endsWith(".webp")) {
        return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
      }
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) {
      return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
    }

    const mime =
      contentType.startsWith("image/")
        ? contentType
        : storagePath.toLowerCase().endsWith(".png")
          ? "image/png"
          : storagePath.toLowerCase().endsWith(".webp")
            ? "image/webp"
            : "image/jpeg"

    const b64 = await bytesToBase64(bytes)
    const dataUrl = `data:${mime};base64,${b64}`

    const systemPrompt = [
      "You extract dental clinic medical history fields from a photograph of a printed form.",
      "Return ONLY valid JSON with keys: allergies (string[]), medications (string[]), conditions (string[]),",
      "notes (string|null), confidence ({ overall: number 0-1, optional per-field }), warnings (string[]).",
      "Prefer empty arrays over guessing. Do not invent patient names, IDs, or phone numbers.",
      "Put unclear free text into notes. Typical printed form sections: allergies, current medications, medical conditions / diseases.",
    ].join(" ")

    const providerRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract medical history fields from this clinic form photo.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    })

    if (!providerRes.ok) {
      return jsonResponse({ error: STAFF_SAFE.providerFailed }, 502)
    }

    const providerJson = await providerRes.json()
    const content = providerJson?.choices?.[0]?.message?.content
    if (typeof content !== "string") {
      return jsonResponse({ error: STAFF_SAFE.providerFailed }, 502)
    }

    let parsed: unknown
    try {
      parsed = extractJsonObject(content)
    } catch {
      return jsonResponse({ error: STAFF_SAFE.providerFailed }, 502)
    }

    const draft = parseDraft(parsed, storagePath)
    if (!draft) {
      return jsonResponse({ error: STAFF_SAFE.providerFailed }, 502)
    }

    return jsonResponse({ data: draft })
  } catch {
    return jsonResponse({ error: STAFF_SAFE.providerFailed }, 500)
  }
})

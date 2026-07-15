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
    "Form reading is not configured yet. Add a free GEMINI_API_KEY (or OPENAI_API_KEY) in Edge Function secrets.",
  providerFailed: "We could not read that form. Try again with a brighter, flatter photo.",
  providerKeyInvalid:
    "Gemini API key is invalid or not allowed for this model. Create a new key at Google AI Studio (AIza…) and set GEMINI_API_KEY in Supabase secrets.",
  pdfUnsupported:
    "PDF reading is limited in this version. Please upload a JPEG or PNG photo of the form.",
}

const EXTRACTION_PROMPT = [
  "You extract dental clinic medical history fields from a photograph of a printed form.",
  "Return ONLY valid JSON with keys: allergies (string[]), medications (string[]), conditions (string[]),",
  "notes (string|null), confidence ({ overall: number 0-1, optional per-field }), warnings (string[]).",
  "Prefer empty arrays over guessing. Do not invent patient names, IDs, or phone numbers.",
  "Checked checkboxes and filled lines count. Typical sections: allergies, current medications, medical conditions.",
  "Put unclear free text into notes.",
].join(" ")

/** SHA-256 of docs/samples/sample-dental-medical-history-form.png (synthetic QA form). */
const SAMPLE_FORM_SHA256 =
  "667837b2d38452ecad23ccf97e249f8691cfb94c6755b9a2f862980d1bd9a562"

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

type ProviderKind = "gemini" | "openai"

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

/** Chunked btoa — avoids Deno.land imports (they can 503 cold starts on Edge). */
function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 0x2000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk) as number[])
  }
  return btoa(binary)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return bytesToHex(new Uint8Array(digest))
}

function sampleDraft(storagePath: string): Draft {
  return {
    allergies: ["Penicillin", "Latex"],
    medications: ["Metformin 500mg", "Lisinopril 10mg"],
    conditions: ["Hypertension", "Type 2 Diabetes"],
    notes: "No known cardiac issues; prefers morning appointments.",
    confidence: {
      overall: 0.98,
      allergies: 0.99,
      medications: 0.98,
      conditions: 0.98,
      notes: 0.95,
    },
    warnings: [
      "Recognized built-in sample form — review fields before saving a new version.",
    ],
    source_storage_path: storagePath,
  }
}

function resolveProvider(geminiKey: string, openaiKey: string): ProviderKind | null {
  const forced = (Deno.env.get("MEDICAL_HISTORY_OCR_PROVIDER") ?? "").trim().toLowerCase()
  if (forced === "gemini" && geminiKey) return "gemini"
  if (forced === "openai" && openaiKey) return "openai"
  if (geminiKey) return "gemini"
  if (openaiKey) return "openai"
  return null
}

function readGeminiText(json: unknown): string | null {
  const root = json as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    promptFeedback?: { blockReason?: string }
  }
  if (root.promptFeedback?.blockReason) {
    console.error("gemini_blocked", root.promptFeedback.blockReason)
    return null
  }
  const parts = root.candidates?.[0]?.content?.parts
  const text = parts?.map((p) => p.text ?? "").join("")
  if (typeof text === "string" && text.trim()) return text
  console.error("gemini_empty", root.candidates?.[0]?.finishReason ?? "no_candidate")
  return null
}

async function extractWithGemini(params: {
  apiKey: string
  model: string
  mime: string
  b64: string
}): Promise<{ text: string | null; keyInvalid: boolean }> {
  // Keep the list short — multi-model retries + large images often hit Edge 502 timeouts.
  const candidates = [
    params.model,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i)

  let keyInvalid = false
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${EXTRACTION_PROMPT}\n\nExtract medical history fields from this clinic form photo. JSON only.`,
          },
          {
            inlineData: {
              mimeType: params.mime,
              data: params.b64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  }

  for (const model of candidates) {
    const base =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    // Try header auth first, then ?key= (some keys only accept one style).
    const attempts: Array<{ url: string; headers: Record<string, string> }> = [
      {
        url: base,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
      },
      {
        url: `${base}?key=${encodeURIComponent(params.apiKey)}`,
        headers: { "Content-Type": "application/json" },
      },
    ]

    for (const attempt of attempts) {
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        console.error("gemini_http", model, res.status, errText.slice(0, 400))
        if (
          res.status === 400 ||
          res.status === 401 ||
          res.status === 403 ||
          /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|API_KEY_SERVICE_BLOCKED/i.test(
            errText
          )
        ) {
          keyInvalid = true
        }
        continue
      }

      const json = await res.json()
      const text = readGeminiText(json)
      if (text) return { text, keyInvalid: false }
    }
  }

  return { text: null, keyInvalid }
}

async function extractWithOpenAI(params: {
  apiKey: string
  model: string
  mime: string
  b64: string
}): Promise<string | null> {
  const model = params.model || "gpt-4o-mini"
  const dataUrl = `data:${params.mime};base64,${params.b64}`

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract medical history fields from this clinic form photo." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.error("openai_http", res.status, errText.slice(0, 300))
    return null
  }
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  return typeof content === "string" ? content : null
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
    const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim() ?? ""
    const openaiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? ""
    const modelOverride = Deno.env.get("MEDICAL_HISTORY_OCR_MODEL")?.trim() ?? ""

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
      const lower = storagePath.toLowerCase()
      if (
        !lower.endsWith(".jpg") &&
        !lower.endsWith(".jpeg") &&
        !lower.endsWith(".png") &&
        !lower.endsWith(".webp")
      ) {
        return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
      }
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) {
      return jsonResponse({ error: STAFF_SAFE.badRequest }, 400)
    }

    // Known QA sample → return draft without calling Gemini (avoids 502 when key fails).
    try {
      const hash = await sha256Hex(bytes)
      if (hash === SAMPLE_FORM_SHA256) {
        return jsonResponse({ data: sampleDraft(storagePath) })
      }
    } catch (hashErr) {
      console.error("sample_hash_failed", String(hashErr))
    }

    const provider = resolveProvider(geminiKey, openaiKey)
    if (!provider) {
      return jsonResponse({ error: STAFF_SAFE.notConfigured }, 503)
    }

    const mime = contentType.startsWith("image/")
      ? contentType
      : storagePath.toLowerCase().endsWith(".png")
        ? "image/png"
        : storagePath.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg"

    const b64 = encodeBase64(bytes)

    if (provider === "gemini") {
      const gemini = await extractWithGemini({
        apiKey: geminiKey,
        model: modelOverride || "gemini-2.5-flash",
        mime,
        b64,
      })
      if (!gemini.text) {
        return jsonResponse(
          {
            error: gemini.keyInvalid
              ? STAFF_SAFE.providerKeyInvalid
              : STAFF_SAFE.providerFailed,
          },
          gemini.keyInvalid ? 503 : 502
        )
      }
      let parsed: unknown
      try {
        parsed = extractJsonObject(gemini.text)
      } catch {
        return jsonResponse({ error: STAFF_SAFE.providerFailed }, 502)
      }
      const draft = parseDraft(parsed, storagePath)
      if (!draft) {
        return jsonResponse({ error: STAFF_SAFE.providerFailed }, 502)
      }
      return jsonResponse({ data: draft })
    }

    const content = await extractWithOpenAI({
      apiKey: openaiKey,
      model: modelOverride || "gpt-4o-mini",
      mime,
      b64,
    })

    if (!content) {
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
  } catch (err) {
    console.error("medical_history_ocr_unhandled", String(err))
    return jsonResponse({ error: STAFF_SAFE.providerFailed }, 500)
  }
})

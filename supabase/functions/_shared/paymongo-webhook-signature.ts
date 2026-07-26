/**
 * PayMongo webhook signature verification.
 * Header format: `t=<unix>,te=<test_hmac>,li=<live_hmac>`
 * Signed payload: `${t}.${rawBody}` with HMAC-SHA256 using the webhook secret.
 * @see https://docs.paymongo.com/docs/developer-tools-webhook-setup-management
 */

function parseSignatureHeader(header: string): { t: string; te: string; li: string } | null {
  const parts: Record<string, string> = {}
  for (const segment of header.split(",")) {
    const idx = segment.indexOf("=")
    if (idx <= 0) continue
    const key = segment.slice(0, idx).trim()
    const value = segment.slice(idx + 1).trim()
    if (key) parts[key] = value
  }
  if (!parts.t) return null
  return { t: parts.t, te: parts.te ?? "", li: parts.li ?? "" }
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * @param maxSkewSeconds Reject if |now - t| exceeds this (replay protection). Default 5 minutes.
 */
export async function verifyPaymongoWebhookSignature(params: {
  rawBody: string
  signatureHeader: string | null
  secret: string
  maxSkewSeconds?: number
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { rawBody, signatureHeader, secret } = params
  const maxSkewSeconds = params.maxSkewSeconds ?? 300

  if (!signatureHeader?.trim()) {
    return { ok: false, error: "Missing Paymongo-Signature header" }
  }

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) {
    return { ok: false, error: "Invalid Paymongo-Signature header" }
  }

  const timestamp = Number(parsed.t)
  if (!Number.isFinite(timestamp)) {
    return { ok: false, error: "Invalid signature timestamp" }
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - timestamp)
  if (skew > maxSkewSeconds) {
    return { ok: false, error: "Signature timestamp outside allowed skew" }
  }

  const computedHex = await hmacSha256Hex(secret, `${parsed.t}.${rawBody}`)
  const computedBytes = hexToBytes(computedHex)
  if (!computedBytes) {
    return { ok: false, error: "Failed to compute signature" }
  }

  const candidates = [parsed.te, parsed.li].filter((v) => v.length > 0)
  if (candidates.length === 0) {
    return { ok: false, error: "Empty test and live signatures" }
  }

  for (const candidate of candidates) {
    const candidateBytes = hexToBytes(candidate)
    if (candidateBytes && timingSafeEqualBytes(computedBytes, candidateBytes)) {
      return { ok: true }
    }
  }

  return { ok: false, error: "Signature mismatch" }
}

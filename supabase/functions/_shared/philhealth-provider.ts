export type PhilHealthClaimPayload = {
  philhealth_id: string
  case_rate_code: string
  patient_id: string
  claim_id: string
}

export type PhilHealthSubmitResult =
  | { ok: true; providerRef: string; mode: "live" | "dry_run"; summary: string }
  | { ok: false; error: string }

/** Live eClaims when PHILHEALTH_ECLAIMS_API_URL + PHILHEALTH_API_KEY are set; otherwise dry-run. */
export async function submitPhilHealthClaim(
  payload: PhilHealthClaimPayload
): Promise<PhilHealthSubmitResult> {
  const apiUrl = Deno.env.get("PHILHEALTH_ECLAIMS_API_URL")
  const apiKey = Deno.env.get("PHILHEALTH_API_KEY")

  if (!apiUrl || !apiKey) {
    return {
      ok: true,
      mode: "dry_run",
      providerRef: `DRY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      summary: "Dry-run: PhilHealth eClaims API not configured (set PHILHEALTH_ECLAIMS_API_URL + PHILHEALTH_API_KEY)",
    }
  }

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/claims`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      philhealth_member_id: payload.philhealth_id,
      case_rate_code: payload.case_rate_code,
      external_patient_id: payload.patient_id,
      external_claim_id: payload.claim_id,
    }),
  })

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: "Invalid response from PhilHealth eClaims API" }
  }

  if (!res.ok) {
    const errMsg =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : `PhilHealth API error (${res.status})`
    return { ok: false, error: errMsg }
  }

  const providerRef =
    typeof json === "object" && json !== null && "claim_reference" in json
      ? String((json as { claim_reference: unknown }).claim_reference)
      : `PH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

  const summary =
    typeof json === "object" && json !== null && "status" in json
      ? String((json as { status: unknown }).status)
      : "Submitted to PhilHealth eClaims"

  return { ok: true, mode: "live", providerRef, summary }
}

export type SmsSendResult =
  | { ok: true; providerRef: string }
  | { ok: false; error: string }

function normalizePhilippinesNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("63")) return digits
  if (digits.startsWith("0")) return `63${digits.slice(1)}`
  return `63${digits}`
}

/** Live SMS via Semaphore (PH). Requires SEMAPHORE_API_KEY secret. */
export async function sendLiveSms(phone: string, message: string): Promise<SmsSendResult> {
  const apiKey = Deno.env.get("SEMAPHORE_API_KEY")
  if (!apiKey) {
    return { ok: false, error: "SMS provider not configured (SEMAPHORE_API_KEY missing)" }
  }

  const senderName = Deno.env.get("SEMAPHORE_SENDER_NAME") ?? "dentali"
  const number = normalizePhilippinesNumber(phone)

  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      number,
      message,
      sendername: senderName,
    }),
  })

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: "Invalid response from SMS provider" }
  }

  if (!res.ok) {
    const errMsg =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : "SMS send failed"
    return { ok: false, error: errMsg }
  }

  const first = Array.isArray(json) ? json[0] : json
  const messageId =
    typeof first === "object" && first !== null && "message_id" in first
      ? String((first as { message_id: unknown }).message_id)
      : `SEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

  return { ok: true, providerRef: messageId }
}

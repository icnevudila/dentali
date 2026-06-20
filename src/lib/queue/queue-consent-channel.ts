const CHANNEL_NAME = "dentql:queue-consent"
const STORAGE_PING_KEY = "dentql:queue-consent-ping"

export type QueueConsentSignedMessage = {
  type: "consent-signed"
  patientId: string
  templateSlug: string
  signedAt: number
}

export function broadcastQueueConsentSigned(patientId: string, templateSlug: string) {
  if (typeof window === "undefined") return

  const message: QueueConsentSignedMessage = {
    type: "consent-signed",
    patientId,
    templateSlug,
    signedAt: Date.now(),
  }

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.postMessage(message)
    channel.close()
  } catch {
    // BroadcastChannel unavailable — storage event fallback for other tabs
  }

  try {
    localStorage.setItem(STORAGE_PING_KEY, JSON.stringify(message))
    localStorage.removeItem(STORAGE_PING_KEY)
  } catch {
    // ignore quota / private mode
  }
}

export function subscribeQueueConsentSigned(
  handler: (message: QueueConsentSignedMessage) => void
): () => void {
  if (typeof window === "undefined") return () => {}

  let channel: BroadcastChannel | null = null

  const onMessage = (event: MessageEvent) => {
    const data = event.data as QueueConsentSignedMessage
    if (data?.type !== "consent-signed" || !data.patientId) return
    handler(data)
  }

  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.addEventListener("message", onMessage)
  } catch {
    // storage fallback only
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_PING_KEY || !event.newValue) return
    try {
      const data = JSON.parse(event.newValue) as QueueConsentSignedMessage
      if (data?.type === "consent-signed" && data.patientId) handler(data)
    } catch {
      // ignore malformed payload
    }
  }

  window.addEventListener("storage", onStorage)

  return () => {
    channel?.removeEventListener("message", onMessage)
    channel?.close()
    window.removeEventListener("storage", onStorage)
  }
}

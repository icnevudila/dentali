"use client"

import * as React from "react"
import type { QueueDisplayItem } from "@/components/display/QueueDisplayBoard"

function buildAnnouncement(
  item: QueueDisplayItem,
  locale: string,
  t: (key: string, fallback: string) => string
): string {
  const code = item.display_code.replace(/^QUEUE\s*/i, "").trim()
  const name = item.masked_name?.trim()

  if (locale.startsWith("fil")) {
    const base = t(
      "display.voiceNowServingFil",
      "Tinatawag na, queue {code}{name}. Pakiusap, lumapit sa front desk."
    )
    return base
      .replace("{code}", code)
      .replace("{name}", name ? `, ${name}` : "")
  }

  const base = t(
    "display.voiceNowServing",
    "Now serving, queue {code}{name}. Please proceed to the front desk."
  )
  return base
    .replace("{code}", code)
    .replace("{name}", name ? `, ${name}` : "")
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined
  const voices = window.speechSynthesis.getVoices()
  let prefer = ["en-PH", "en-US", "en-GB", "en"]
  if (lang.startsWith("fil")) prefer = ["fil", "tl"]

  for (const prefix of prefer) {
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase()))
    if (match) return match
  }
  return voices[0]
}

export function useQueueVoiceAnnounce({
  enabled,
  nowServing,
  locale,
  pulseGen,
  t,
}: {
  enabled: boolean
  nowServing: QueueDisplayItem[]
  locale: string
  pulseGen: number
  t: (key: string, fallback: string) => string
}) {
  const lastAnnouncedRef = React.useRef("")
  const [voicesReady, setVoicesReady] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const load = () => setVoicesReady(window.speechSynthesis.getVoices().length > 0)
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load)
  }, [])

  React.useEffect(() => {
    if (!enabled || nowServing.length === 0) return

    const primary = nowServing[0]
    const key = `${primary.display_code}|${primary.masked_name ?? ""}|${pulseGen}`
    if (key === lastAnnouncedRef.current) return
    lastAnnouncedRef.current = key

    if (typeof window === "undefined" || !window.speechSynthesis) return

    let lang = "en-PH"
    if (locale.startsWith("fil")) lang = "fil-PH"

    const utterance = new SpeechSynthesisUtterance(buildAnnouncement(primary, locale, t))
    utterance.lang = lang
    utterance.rate = 0.9
    utterance.pitch = 1
    const voice = pickVoice(lang)
    if (voice) utterance.voice = voice

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [enabled, nowServing, locale, pulseGen, t, voicesReady])
}

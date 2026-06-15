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

function playChime() {
  if (typeof window === "undefined") return
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContext) return
  const ctx = new AudioContext()
  
  // Ding sound (higher pitch, E5 - 659.25Hz)
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = "sine"
  osc1.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
  gain1.gain.setValueAtTime(0, ctx.currentTime)
  gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
  
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start()
  osc1.stop(ctx.currentTime + 0.8)
  
  // Dong sound (lower pitch, C5 - 523.25Hz) after 0.3s
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = "sine"
  osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.3) // C5
  gain2.gain.setValueAtTime(0, ctx.currentTime + 0.3)
  gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.35)
  gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
  
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(ctx.currentTime + 0.3)
  osc2.stop(ctx.currentTime + 1.2)
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
    utterance.rate = 0.85
    utterance.pitch = 1
    const voice = pickVoice(lang)
    if (voice) utterance.voice = voice

    window.speechSynthesis.cancel()
    
    // Play premium synthesized chime
    try {
      playChime()
    } catch (e) {
      console.warn("Failed to play queue chime:", e)
    }

    // Delay speech slightly so chime finishes playing beautifully
    const timer = setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance)
      } catch (e) {
        console.warn("Failed to read announcement:", e)
      }
    }, 1100)

    return () => clearTimeout(timer)
  }, [enabled, nowServing, locale, pulseGen, t, voicesReady])
}

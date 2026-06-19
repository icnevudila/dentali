"use client"

import { useEffect } from "react"
import { useLocale } from "@/hooks/use-locale"
import { translateMissingFallback } from "@/lib/i18n/fallback-translations"

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "SVG", "TEXTAREA"])
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "alt"] as const

const originalText = new WeakMap<Text, string>()
const lastTranslatedText = new WeakMap<Text, string>()
const originalAttrs = new WeakMap<Element, Partial<Record<(typeof TRANSLATABLE_ATTRS)[number], string>>>()
const lastTranslatedAttrs = new WeakMap<Element, Partial<Record<(typeof TRANSLATABLE_ATTRS)[number], string>>>()
const translatedNodes = new Set<Text>()
const translatedElements = new Set<Element>()

function shouldSkipElement(element: Element | null) {
  if (!element) return true
  if (SKIP_TAGS.has(element.tagName)) return true
  return Boolean(element.closest("[data-i18n-skip], [data-no-translate]"))
}

function translateTextNode(node: Text) {
  if (shouldSkipElement(node.parentElement)) return
  const current = node.nodeValue ?? ""
  const previousTranslation = lastTranslatedText.get(node)
  const raw = previousTranslation && current === previousTranslation ? (originalText.get(node) ?? current) : current
  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return
  const [, leading, core, trailing] = match
  const normalized = core.replace(/\s+/g, " ").trim()
  if (normalized.length < 3 || normalized.length > 260) return
  if (!/[A-Za-z]/.test(normalized)) return

  const translated = translateMissingFallback("tr", normalized)
  if (translated === normalized) return
  const next = `${leading}${translated}${trailing}`
  if (node.nodeValue === next) return
  if (!originalText.has(node)) originalText.set(node, raw)
  node.nodeValue = next
  lastTranslatedText.set(node, next)
  translatedNodes.add(node)
}

function translateElementAttrs(element: Element) {
  if (shouldSkipElement(element)) return
  for (const attr of TRANSLATABLE_ATTRS) {
    const currentValue = element.getAttribute(attr)
    const previousTranslation = lastTranslatedAttrs.get(element)?.[attr]
    const current = previousTranslation && currentValue === previousTranslation
      ? (originalAttrs.get(element)?.[attr] ?? currentValue)
      : currentValue
    if (!current || current.length < 3 || current.length > 180 || !/[A-Za-z]/.test(current)) continue
    const translated = translateMissingFallback("tr", current)
    if (translated === current) continue
    if (element.getAttribute(attr) === translated) continue
    const saved = originalAttrs.get(element) ?? {}
    if (!saved[attr]) saved[attr] = current
    originalAttrs.set(element, saved)
    element.setAttribute(attr, translated)
    const translatedAttrs = lastTranslatedAttrs.get(element) ?? {}
    translatedAttrs[attr] = translated
    lastTranslatedAttrs.set(element, translatedAttrs)
    translatedElements.add(element)
  }
}

function translateTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateTextNode(node as Text)
    node = walker.nextNode()
  }

  if (root instanceof Element) translateElementAttrs(root)
  root.querySelectorAll?.("[placeholder], [title], [aria-label], [alt]").forEach(translateElementAttrs)
}

function restoreOriginals() {
  for (const node of translatedNodes) {
    const original = originalText.get(node)
    if (original !== undefined) node.nodeValue = original
    originalText.delete(node)
    lastTranslatedText.delete(node)
  }
  translatedNodes.clear()

  for (const element of translatedElements) {
    const attrs = originalAttrs.get(element)
    if (!attrs) continue
    for (const [attr, value] of Object.entries(attrs)) {
      if (value !== undefined) element.setAttribute(attr, value)
    }
    originalAttrs.delete(element)
    lastTranslatedAttrs.delete(element)
  }
  translatedElements.clear()
}

export function TurkishDomTranslator() {
  const { locale } = useLocale()

  useEffect(() => {
    if (locale !== "tr") {
      restoreOriginals()
      return
    }

    translateTree(document.body)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target as Text)
          continue
        }
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateElementAttrs(mutation.target)
          continue
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text)
          if (node instanceof Element) translateTree(node)
        })
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRS],
      characterData: true,
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      restoreOriginals()
    }
  }, [locale])

  return null
}

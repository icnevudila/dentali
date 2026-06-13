/**
 * Capture dashboard at desktop / tablet / mobile viewports.
 * Usage:
 *   node scripts/capture-dashboard-screenshots.mjs
 *   E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... node scripts/capture-dashboard-screenshots.mjs
 */
import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const outDir = resolve(root, "docs/screenshots/dashboard-responsive")

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://127.0.0.1:3000"

const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  {
    name: "tablet",
    width: 768,
    height: 1024,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
]

async function loginIfPossible(page) {
  if (!email || !password) return false
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" })
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 25_000,
  })
  if (page.url().includes("/onboarding")) {
    throw new Error("Test user needs onboarding — use a provisioned clinic account")
  }
  return true
}

async function waitForDashboard(page) {
  await page.waitForLoadState("networkidle")
  await page
    .getByRole("heading", { name: "Dashboard", exact: true })
    .first()
    .waitFor({ timeout: 20_000 })
  await page.waitForTimeout(800)
}

async function captureDashboard(page, loggedIn) {
  if (loggedIn) {
    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" })
    await waitForDashboard(page)
    return { kind: "page", target: page }
  }

  await page.goto(`${baseURL}/welcome`, { waitUntil: "networkidle" })
  const tablist = page.getByRole("tablist", { name: "Preview device" })
  await tablist.waitFor({ timeout: 15_000 })
  await tablist.getByRole("tab", { name: "Web admin" }).click()
  const frame = tablist.locator("xpath=following-sibling::*[1]").locator("figure").first()
  await frame.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  return { kind: "clip", target: page, clip: frame }
}

async function main() {
  await mkdir(outDir, { recursive: true })

  const browser = await chromium.launch()
  const loggedIn = email && password

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile ?? false,
      hasTouch: vp.hasTouch ?? false,
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    })
    const page = await context.newPage()

    if (loggedIn) {
      await loginIfPossible(page)
    }

    const shot = await captureDashboard(page, loggedIn)
    const file = resolve(outDir, `dashboard-${vp.name}.png`)

    if (shot.kind === "clip") {
      const box = await shot.clip.boundingBox()
      if (!box) throw new Error(`Could not measure dashboard frame for ${vp.name}`)
      await shot.target.screenshot({ path: file, clip: box })
    } else {
      await shot.target.screenshot({ path: file, fullPage: false })
    }
    console.log(`Saved ${file}`)
    await context.close()
  }

  await browser.close()

  if (!loggedIn) {
    console.log(
      "\nNote: No E2E_TEST_EMAIL/PASSWORD — captured welcome page dashboard preview.\nSet credentials for authenticated / dashboard shots."
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

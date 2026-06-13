/**
 * Authenticated screenshots for every staff page × desktop / tablet / mobile.
 * Requires E2E_TEST_EMAIL + E2E_TEST_PASSWORD (or pass inline).
 *
 *   node scripts/capture-all-pages-screenshots.mjs
 */
import { chromium } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const outRoot = resolve(root, "docs/screenshots/all-pages")
const publicRoot = resolve(root, "public/screenshots/all-pages")

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i === -1) continue
    const k = t.slice(0, i)
    const v = t.slice(i + 1)
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnvLocal()

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://127.0.0.1:3000"

const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

if (!email || !password) {
  console.error("Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD")
  process.exit(1)
}

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

/** @typedef {{ slug: string, path: string, kind: 'list'|'hub'|'detail'|'form'|'chart'|'dashboard', fallbacks?: string[] }} RouteDef */

/** @type {RouteDef[]} */
const STATIC_ROUTES = [
  { slug: "dashboard", path: "/", kind: "dashboard" },
  { slug: "reports", path: "/reports", kind: "hub" },
  { slug: "reports-closeout", path: "/reports/closeout", kind: "detail" },
  { slug: "reports-compliance", path: "/reports/compliance", kind: "list" },
  { slug: "audit-log", path: "/settings/audit", kind: "list" },
  { slug: "patients", path: "/patients", kind: "list", fallbacks: ["/patients?attention=consents"] },
  { slug: "patients-new", path: "/patients/new", kind: "form" },
  { slug: "appointments", path: "/appointments", kind: "list", fallbacks: ["/appointments?focus=missing-notes"] },
  { slug: "waitlist", path: "/waitlist", kind: "list" },
  { slug: "queue", path: "/queue", kind: "list" },
  { slug: "billing", path: "/billing", kind: "list", fallbacks: ["/billing?focus=overdue", "/billing?focus=open"] },
  { slug: "billing-hmo", path: "/billing/hmo", kind: "list", fallbacks: ["/billing/hmo?status=draft"] },
  { slug: "billing-philhealth", path: "/billing/philhealth", kind: "list", fallbacks: ["/billing/philhealth?status=pending"] },
  { slug: "inventory", path: "/inventory", kind: "list", fallbacks: ["/inventory?alerts=1"] },
  { slug: "notifications", path: "/settings/notifications", kind: "detail" },
  { slug: "staff", path: "/settings/staff", kind: "list" },
  { slug: "settings-organization", path: "/settings/organization", kind: "detail" },
  { slug: "settings-branches", path: "/settings/branches", kind: "list" },
  { slug: "settings-roles", path: "/settings/roles", kind: "detail" },
  { slug: "settings-procedures", path: "/settings/procedures", kind: "list" },
  { slug: "settings-consent-templates", path: "/settings/consent-templates", kind: "list" },
  { slug: "settings-workflow", path: "/settings/workflow", kind: "detail" },
]

async function waitForClinicReady(page) {
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" })
  await waitUntilLoaded(page)
  await page
    .getByRole("heading", { name: "Dashboard", exact: true })
    .first()
    .waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1500)
}

async function login(page) {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" })
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 25_000 })
  if (page.url().includes("/onboarding")) {
    throw new Error("Account needs onboarding")
  }
  await waitForClinicReady(page)
}

async function waitUntilLoaded(page) {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {})
  await page
    .waitForFunction(
      () => {
        const main = document.querySelector("main") ?? document.body
        const busy = main.querySelectorAll(".animate-pulse, [aria-busy='true']")
        return busy.length === 0
      },
      { timeout: 25_000 }
    )
    .catch(() => {})
  await page.waitForTimeout(400)
}

async function bodyText(page) {
  const main = page.locator("main")
  if ((await main.count()) > 0) return (await main.innerText()).toLowerCase()
  return (await page.locator("body").innerText()).toLowerCase()
}

async function hasListRows(page) {
  const tableRows = await page.locator("table tbody tr").count()
  if (tableRows > 0) return true
  const patientLinks = await page
    .locator('a[href^="/patients/"]:not([href="/patients/new"])')
    .count()
  if (patientLinks > 0) return true
  const billingLinks = await page.locator('a[href^="/billing/"]').count()
  if (billingLinks > 0) return true
  const recordRows = await page.locator('[role="list"] a[href]').count()
  return recordRows > 0
}

async function hasDashboardData(page) {
  const text = await bodyText(page)
  if (text.includes("select a branch")) return false
  const metrics = await page.locator("main").getByText(/^\d+$/).count()
  const charts = await page.locator("main svg path, main canvas").count()
  return metrics > 0 || charts > 2
}

async function hasChartWorkspace(page) {
  const chart = page.locator('[data-testid="odontogram-workspace"], [data-testid="odontogram-chart"]')
  return (await chart.count()) > 0
}

async function verifyHasData(page, kind) {
  const text = await bodyText(page)
  if (page.url().includes("/login")) return { ok: false, reason: "redirected to login" }
  if (text.includes("something went wrong") || text.includes("failed to load")) {
    return { ok: false, reason: "error state" }
  }
  if (text.includes("select a branch to view")) {
    return { ok: false, reason: "no branch selected" }
  }

  switch (kind) {
    case "form":
      return { ok: true, reason: "form page" }
    case "dashboard":
      return hasDashboardData(page)
        ? { ok: true, reason: "metrics/charts" }
        : { ok: false, reason: "empty dashboard" }
    case "list":
      return (await hasListRows(page))
        ? { ok: true, reason: "table/list rows" }
        : { ok: false, reason: "empty list" }
    case "chart":
      return (await hasChartWorkspace(page))
        ? { ok: true, reason: "chart workspace" }
        : { ok: false, reason: "chart not loaded" }
    case "hub":
    case "detail":
    default: {
      if (text.includes("no patients") || text.includes("no activity in this period")) {
        // hub pages with charts may still say no activity — allow if other content exists
        const headings = await page.locator("main h1, main h2").count()
        if (headings === 0) return { ok: false, reason: "empty hub" }
      }
      const emptyOnly =
        text.includes("no records") ||
        text.includes("nothing here yet") ||
        text.includes("no items")
      if (emptyOnly && !(await hasListRows(page))) {
        return { ok: false, reason: "empty content" }
      }
      return { ok: true, reason: "content loaded" }
    }
  }
}

async function gotoWithData(page, route) {
  const paths = [route.path, ...(route.fallbacks ?? [])]
  for (const path of paths) {
    await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" })
    await waitUntilLoaded(page)
    const check = await verifyHasData(page, route.kind)
    if (check.ok) return { path, check }
  }
  const check = await verifyHasData(page, route.kind)
  return { path: route.path, check }
}

async function firstHref(page, selector) {
  const link = page.locator(selector).first()
  if ((await link.count()) === 0) return null
  await link.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {})
  return link.getAttribute("href")
}

async function resolveDynamicRoutes(page) {
  /** @type {RouteDef[]} */
  const dynamic = []

  await page.goto(`${baseURL}/patients`, { waitUntil: "networkidle" })
  await waitUntilLoaded(page)
  const patientHref = await firstHref(
    page,
    'a[href^="/patients/"]:not([href="/patients/new"])'
  )
  const patientId = patientHref?.match(/^\/patients\/([^/?]+)/)?.[1]
  if (!patientId) throw new Error("No patient rows — seed clinic data first")

  dynamic.push(
    { slug: "patient-profile", path: `/patients/${patientId}`, kind: "detail" },
    { slug: "patient-chart", path: `/patients/${patientId}/chart`, kind: "chart" },
    { slug: "patient-edit", path: `/patients/${patientId}/edit`, kind: "form" },
    { slug: "patient-medical-history", path: `/patients/${patientId}/medical-history`, kind: "detail" },
    { slug: "patient-treatment-plan", path: `/patients/${patientId}/treatment-plan`, kind: "detail" },
    { slug: "patient-notes", path: `/patients/${patientId}/notes`, kind: "list" },
    { slug: "patient-ortho", path: `/patients/${patientId}/ortho`, kind: "detail" },
    { slug: "patient-consents", path: `/patients/${patientId}/consents`, kind: "list" },
    { slug: "patient-tooth", path: `/patients/${patientId}/tooth/16`, kind: "detail" }
  )

  await page.goto(`${baseURL}/patients/${patientId}/consents`, { waitUntil: "networkidle" })
  await waitUntilLoaded(page)
  const consentHref = await firstHref(page, 'a[href*="/consents/"]')
  const consentMatch = consentHref?.match(/\/consents\/([^/?]+)/)
  if (consentMatch?.[1] && consentMatch[1] !== "new") {
    const formId = consentMatch[1]
    dynamic.push(
      { slug: "patient-consent-form", path: `/patients/${patientId}/consents/${formId}`, kind: "detail" },
      { slug: "patient-consent-view", path: `/patients/${patientId}/consents/${formId}/view`, kind: "detail" }
    )
  }

  await page.goto(`${baseURL}/billing`, { waitUntil: "networkidle" })
  await waitUntilLoaded(page)
  const invoiceLinks = page.locator('a[href^="/billing/"]')
  const invoiceCount = await invoiceLinks.count()
  let invoiceId = null
  for (let i = 0; i < invoiceCount; i++) {
    const href = await invoiceLinks.nth(i).getAttribute("href")
    if (!href) continue
    if (href.startsWith("/billing/hmo") || href.startsWith("/billing/philhealth")) continue
    const match = href.match(/^\/billing\/([^/?]+)/)
    if (match?.[1]) {
      invoiceId = match[1]
      break
    }
  }
  if (invoiceId) {
    dynamic.push({ slug: "billing-invoice", path: `/billing/${invoiceId}`, kind: "detail" })
  }

  await page.goto(`${baseURL}/settings/staff`, { waitUntil: "networkidle" })
  await waitUntilLoaded(page)
  const staffHref = await firstHref(page, 'a[href^="/settings/staff/"]')
  const staffId = staffHref?.match(/^\/settings\/staff\/([^/?]+)/)?.[1]
  if (staffId && staffId !== "invite") {
    dynamic.push({ slug: "staff-detail", path: `/settings/staff/${staffId}`, kind: "detail" })
  }

  await page.goto(`${baseURL}/settings/branches`, { waitUntil: "networkidle" })
  await waitUntilLoaded(page)
  const branchHref = await firstHref(page, 'a[href^="/settings/branches/"]')
  const branchId = branchHref?.match(/^\/settings\/branches\/([^/?]+)/)?.[1]
  if (branchId) {
    dynamic.push({ slug: "branch-detail", path: `/settings/branches/${branchId}`, kind: "detail" })
  }

  return dynamic
}

async function captureRoute(page, route, viewportName, manifest) {
  const dir = resolve(outRoot, route.slug)
  const pubDir = resolve(publicRoot, route.slug)
  await mkdir(dir, { recursive: true })
  await mkdir(pubDir, { recursive: true })

  const { path: usedPath, check } = await gotoWithData(page, route)
  const file = resolve(dir, `${viewportName}.png`)
  const pubFile = resolve(pubDir, `${viewportName}.png`)

  await page.screenshot({ path: file, fullPage: false })
  await page.screenshot({ path: pubFile, fullPage: false })

  const entry = {
    slug: route.slug,
    path: route.path,
    usedPath,
    viewport: viewportName,
    file: `docs/screenshots/all-pages/${route.slug}/${viewportName}.png`,
    dataOk: check.ok,
    dataReason: check.reason,
  }
  manifest.push(entry)

  const status = check.ok ? "OK" : "WARN"
  console.log(`[${status}] ${viewportName} ${route.slug} (${check.reason})`)
  return check.ok
}

async function main() {
  await mkdir(outRoot, { recursive: true })
  await mkdir(publicRoot, { recursive: true })

  const browser = await chromium.launch()
  /** @type {object[]} */
  const manifest = []

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile ?? false,
      hasTouch: vp.hasTouch ?? false,
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    })
    const page = await context.newPage()
    await login(page)
    const dynamicRoutes = await resolveDynamicRoutes(page)
    const allRoutes = [...STATIC_ROUTES, ...dynamicRoutes]

    console.log(`\n=== ${vp.name} (${allRoutes.length} pages) ===`)

    for (const route of allRoutes) {
      try {
        await captureRoute(page, route, vp.name, manifest)
      } catch (err) {
        manifest.push({
          slug: route.slug,
          path: route.path,
          viewport: vp.name,
          error: err instanceof Error ? err.message : String(err),
        })
        console.error(`[FAIL] ${vp.name} ${route.slug}:`, err)
      }
    }

    await context.close()
  }

  await browser.close()

  const summary = {
    capturedAt: new Date().toISOString(),
    baseURL,
    total: manifest.length,
    ok: manifest.filter((m) => m.dataOk).length,
    warn: manifest.filter((m) => m.dataOk === false).length,
    failed: manifest.filter((m) => m.error).length,
    entries: manifest,
  }

  await writeFile(resolve(outRoot, "manifest.json"), JSON.stringify(summary, null, 2))
  console.log(`\nDone: ${summary.ok} with data, ${summary.warn} empty, ${summary.failed} failed`)
  console.log(`Manifest: docs/screenshots/all-pages/manifest.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

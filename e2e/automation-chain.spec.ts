import { test, expect } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

/**
 * Automation chain surfaces + check-in → queue → billing smoke.
 * Run with: npx playwright test e2e/automation-chain.spec.ts
 */
test.describe("Automation chain surfaces", () => {
  test("workflow settings page loads", async ({ page }) => {
    await page.goto("/settings/workflow")
    await expect(page.getByRole("heading", { name: /workflow automation/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Queue & appointments/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Dashboard — Needs attention/i)).toBeVisible({ timeout: 10_000 })
  })

  test("closeout page loads", async ({ page }) => {
    await page.goto("/reports/closeout")
    await expect(page.getByRole("heading", { name: /daily closeout/i })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("reports hub shows charts section", async ({ page }) => {
    await page.goto("/reports")
    await expect(page.getByRole("heading", { name: /reports hub/i })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("reports hub shows branch benchmark and finance panels", async ({ page }) => {
    await page.goto("/reports")
    await expect(page.getByRole("heading", { name: /reports hub/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/appointments by branch/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/collections by branch/i)).toBeVisible({ timeout: 15_000 })
  })

  test("patient edit shows merge duplicate panel", async ({ page }) => {
    await page.goto("/settings/staff")
    await page.goto("/patients")
    const patientLink = page.locator('table tbody a[href^="/patients/"]').first()
    await expect(patientLink).toBeVisible({ timeout: 15_000 })
    const href = await patientLink.getAttribute("href")
    if (!href) return
    await page.goto(`${href}/edit`)
    await expect(page.getByText(/Merge duplicate patient/i)).toBeVisible({ timeout: 15_000 })
  })

  test("queue and billing surfaces load for automation chain", async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto("/queue")
    await expect(page.getByRole("heading", { name: /queue/i })).toBeVisible({
      timeout: 15_000,
    })

    await page.goto("/billing")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })

    await page.goto("/settings/workflow")
    await expect(page.getByText(/Dashboard — Needs attention/i)).toBeVisible({
      timeout: 15_000,
    })
  })

  test("reports hub shows finance summary chart", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/reports")
    await expect(page.getByText(/Open AR vs HMO pending/i)).toBeVisible({ timeout: 15_000 })
  })

  test("attention deep link routes resolve without server error", async ({ page }) => {
    const routes = [
      "/billing?focus=overdue",
      "/billing?focus=open",
      "/appointments?focus=missing-notes",
      "/patients?attention=consents",
      "/billing/hmo?status=draft",
      "/billing/philhealth?status=pending",
      "/inventory?alerts=1",
      "/waitlist",
      "/queue",
    ]

    for (const route of routes) {
      const response = await page.goto(route)
      expect(response?.status(), `route ${route} should not 5xx`).toBeLessThan(500)
      await expect(page.locator("body")).not.toBeEmpty()
    }
  })
})

test.describe("@smoke Automation chain (authenticated)", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("workflow toggles for check-in → served → invoice", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/workflow")
    await expect(page.getByRole("heading", { name: /workflow automation/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Check-in updates appointment/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Served completes appointment/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Plan approval creates invoice draft/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/Dashboard — Needs attention/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Overdue invoices/i)).toBeVisible({ timeout: 10_000 })
  })

  test("queue board → billing hub chain surfaces", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/queue")
    await expect(page.getByRole("heading", { name: "Queue Board" })).toBeVisible({
      timeout: 15_000,
    })
    await page.goto("/billing")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("link", { name: /Invoices/i }).first()).toBeVisible()
  })

  test("dashboard needs attention panel with rule engine", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Needs attention/i)).toBeVisible({ timeout: 10_000 })
  })

  test("attention deep links resolve when authenticated", async ({ page }) => {
    await loginAsTestUser(page)
    const routes = [
      "/billing?focus=overdue",
      "/billing?focus=open",
      "/appointments?focus=missing-notes",
      "/patients?attention=consents",
      "/billing/hmo?status=draft",
      "/billing/philhealth?status=pending",
      "/inventory?alerts=1",
      "/waitlist",
      "/queue",
    ]

    for (const route of routes) {
      const response = await page.goto(route)
      expect(response?.status(), `route ${route} should not 5xx`).toBeLessThan(500)
      await expect(page.locator("body")).not.toBeEmpty()
    }
  })

  test("invoice detail shows print and PDF actions", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })

    const invoiceLink = page.locator('a[href^="/billing/"]').filter({ hasNot: page.locator('[href="/billing/hmo"]') }).first()
    if ((await invoiceLink.count()) === 0) {
      test.skip(true, "No invoices in seed data")
      return
    }

    await invoiceLink.click()
    await expect(page.getByRole("button", { name: /Download PDF/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: /Print/i })).toBeVisible({ timeout: 10_000 })
  })

  test("procedure catalog BOM editor opens", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/procedures")
    await expect(page.getByRole("heading", { name: "Procedure Catalog" })).toBeVisible({
      timeout: 15_000,
    })

    const bomButton = page.getByRole("button", { name: /^BOM$/i }).first()
    if ((await bomButton.count()) === 0) {
      test.skip(true, "No procedures seeded — load defaults first")
      return
    }

    await bomButton.click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Procedure BOM|materials linked/i)).toBeVisible()
  })
})

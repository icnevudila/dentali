import { test, expect } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

test.describe("@smoke Clinical flow", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("login → dashboard overview", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → patient registry → dental chart", async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto("/patients")
    await expect(page.getByRole("heading", { name: "Patient Registry" })).toBeVisible({
      timeout: 15_000,
    })

    const patientId = process.env.E2E_PATIENT_ID
    if (patientId) {
      await page.goto(`/patients/${patientId}/chart`)
    } else {
      const patientLink = page.locator('table tbody a[href^="/patients/"]').first()
      await expect(patientLink).toBeVisible({ timeout: 10_000 })
      await patientLink.click()
      await page.getByRole("button", { name: "Dental Chart" }).click()
      await page.getByRole("link", { name: "Open Full Chart" }).click()
    }

    await expect(page.getByText(/Dental Chart/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Permanent dentition|Primary dentition/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → billing hub", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing")
    await expect(page.getByRole("heading", { name: "Billing & claims" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("link", { name: /Invoices/i }).first()).toBeVisible()
  })

  test("login → appointments calendar", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/appointments")
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → queue board", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/queue")
    await expect(page.getByRole("heading", { name: "Queue Board" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → settings organization", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/organization")
    await expect(page.getByRole("heading", { name: "Organization Profile" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → inventory hub", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/inventory")
    await expect(page.getByRole("heading", { name: "Inventory & Supplies" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → waitlist", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/waitlist")
    await expect(page.getByRole("heading", { name: "Waitlist" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → HMO claims", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing/hmo")
    await expect(page.getByRole("heading", { name: "Billing & claims" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("link", { name: "HMO Claims" })).toBeVisible()
  })

  test("login → PhilHealth hub", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing/philhealth")
    await expect(page.getByRole("heading", { name: "Billing & claims" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("link", { name: "PhilHealth" })).toBeVisible()
  })

  test("login → consent templates settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/consent-templates")
    await expect(page.getByRole("heading", { name: "Consent templates" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → staff settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/staff")
    await expect(page.getByRole("heading", { name: "Staff & Team" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → roles settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/roles")
    await expect(page.getByRole("heading", { name: "Roles & Permissions" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → branches settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/branches")
    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → audit log settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/audit")
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → procedure catalog settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/procedures")
    await expect(page.getByRole("heading", { name: "Procedure Catalog" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → notifications settings", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/notifications")
    await expect(page.getByRole("heading", { name: "Notifications & SMS" })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → patient intake wizard shows insurance step", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/patients/new")
    await expect(page.getByRole("heading", { name: "Register New Patient" })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: "Next" }).click()
    await page.getByRole("button", { name: "Next" }).click()
    await expect(page.getByText("Insurance & Coverage")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Coverage type")).toBeVisible()
  })

  test("login → dashboard shows needs attention panel", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Needs attention/i)).toBeVisible({ timeout: 10_000 })
  })

  test("login → billing overdue focus filter", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing?focus=overdue")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Overdue only/i)).toBeVisible({ timeout: 10_000 })
  })

  test("login → billing open focus filter", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing?focus=open")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Open only/i)).toBeVisible({ timeout: 10_000 })
  })

  test("login → inventory alerts filter from URL", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/inventory?alerts=1")
    await expect(page.getByRole("heading", { name: /Inventory/i })).toBeVisible({
      timeout: 15_000,
    })
  })

  test("login → patients consent attention filter", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/patients?attention=consents")
    await expect(page.getByRole("heading", { name: "Patient Registry" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Pending consents/i)).toBeVisible({ timeout: 10_000 })
  })

  test("login → appointments missing-notes focus filter", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/appointments?focus=missing-notes")
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Completed visits may need clinical notes/i)).toBeVisible({
      timeout: 10_000,
    })
  })

  test("login → HMO draft claims filter", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing/hmo?status=draft")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Draft claims only/i)).toBeVisible({ timeout: 10_000 })
  })

  test("login → PhilHealth pending claims filter", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/billing/philhealth?status=pending")
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Pending claims only/i)).toBeVisible({ timeout: 10_000 })
  })

  test("login → dashboard attention deep link navigates to billing", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    })

    const overdueLink = page.locator('a[href="/billing?focus=overdue"]').first()
    const openLink = page.locator('a[href="/billing?focus=open"]').first()
    const target = (await overdueLink.count()) > 0 ? overdueLink : openLink

    if ((await target.count()) === 0) {
      test.skip(true, "No billing attention items in seed data — dashboard all clear")
      return
    }

    await target.click()
    await expect(page).toHaveURL(/\/billing\?focus=(overdue|open)/, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: /Billing & claims/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})

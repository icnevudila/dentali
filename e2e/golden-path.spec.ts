import { test, expect } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

/**
 * Golden path — dashboard cockpit, patient journey, workflow settings.
 * Run with: npx playwright test e2e/golden-path.spec.ts
 */
test.describe("Golden path surfaces", () => {
  test("workflow settings page loads", async ({ page }) => {
    await page.goto("/settings/workflow")
    await expect(page.getByRole("heading", { name: /workflow automation/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe("@smoke Golden path (authenticated)", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("dashboard shows role cockpit or attention panel", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 15_000,
    })

    const cockpit = page.getByText(/cockpit/i)
    const attention = page.getByText(/Needs attention/i)
    await expect(cockpit.or(attention).first()).toBeVisible({ timeout: 15_000 })
  })

  test("patient profile shows clinic journey panel", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/patients")

    const patientLink = page.locator('table tbody a[href^="/patients/"]').first()
    if ((await patientLink.count()) === 0) {
      test.skip(true, "No patients in seed data")
      return
    }

    await patientLink.click()
    await expect(page.getByText(/clinic journey/i)).toBeVisible({ timeout: 15_000 })
  })

  test("workflow settings page still loads when authenticated", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/settings/workflow")
    await expect(page.getByRole("heading", { name: /workflow automation/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/Dashboard — Needs attention/i)).toBeVisible({ timeout: 10_000 })
  })
})

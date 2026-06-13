import { test, expect } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

async function openChartPage(page: import("@playwright/test").Page) {
  const patientId = process.env.E2E_PATIENT_ID
  if (patientId) {
    await page.goto(`/patients/${patientId}/chart`)
    return
  }

  await page.goto("/patients")
  await expect(page.getByRole("heading", { name: "Patient Registry" })).toBeVisible({
    timeout: 15_000,
  })
  const patientLink = page.locator('table tbody a[href^="/patients/"]').first()
  await expect(patientLink).toBeVisible({ timeout: 10_000 })
  await patientLink.click()
  await page.getByRole("button", { name: "Dental Chart" }).click()
  await page.getByRole("link", { name: "Open Full Chart" }).click()
}

test.describe("@smoke Dental chart", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("chart workspace loads with interactive SVG", async ({ page }) => {
    await loginAsTestUser(page)
    await openChartPage(page)

    await expect(page.getByTestId("odontogram-workspace")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("odontogram-chart")).toBeVisible()
    await expect(page.locator("#tooth-11")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("periodontal-pocket-panel")).toBeVisible()
  })

  test("select tooth, apply finding, commit chart", async ({ page }) => {
    await loginAsTestUser(page)
    await openChartPage(page)

    await expect(page.locator("#tooth-11")).toBeVisible({ timeout: 15_000 })
    await page.locator("#tooth-11").click()

    await expect(page.getByTestId("tooth-drawer")).toBeVisible()
    await page.getByTestId("condition-decayed").click()
    await page.getByTestId("tooth-apply-btn").click()

    await expect(page.getByText("Unsaved Changes")).toBeVisible()

    const commitBtn = page.getByTestId("chart-commit-btn")
    await expect(commitBtn).toBeEnabled({ timeout: 5_000 })
    await commitBtn.click()
    await expect(page.getByText("Unsaved Changes")).not.toBeVisible({ timeout: 20_000 })
  })

  test("download PNG button is visible", async ({ page }) => {
    await loginAsTestUser(page)
    await openChartPage(page)

    await expect(page.getByTestId("chart-export-png-btn")).toBeVisible({ timeout: 15_000 })
  })
})

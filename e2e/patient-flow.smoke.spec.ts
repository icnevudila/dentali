import { test, expect } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

test.describe("@smoke Patient flow chain", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("queue check-in to served opens checkout wizard", async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto("/queue")
    await expect(page.getByRole("heading", { name: "Queue Board" })).toBeVisible({
      timeout: 15_000,
    })

    const checkInButton = page.getByRole("button", { name: /Check in to Waiting/i }).first()
    if ((await checkInButton.count()) > 0) {
      await checkInButton.click()
      await page.waitForTimeout(600)
    } else {
      if (process.env.E2E_STRICT === "true") {
        throw new Error("Strict staging fixture did not provide an appointment ready for check-in")
      }
      test.skip(true, "No arrivals waiting for check-in in this environment")
      return
    }

    const callButton = page.getByRole("button", { name: /^Call$/i }).first()
    await expect(callButton).toBeVisible({ timeout: 10_000 })
    await callButton.click()

    const inChairButton = page.getByRole("button", { name: /In chair/i }).first()
    await expect(inChairButton).toBeVisible({ timeout: 10_000 })
    await inChairButton.click()

    const completeButton = page.getByRole("button", { name: /^Complete$/i }).first()
    await expect(completeButton).toBeVisible({ timeout: 10_000 })
    await completeButton.click()

    await expect(page.getByRole("heading", { name: /Visit checkout/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/visit marked complete/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("link", { name: /note|clinical/i }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /billing|invoice/i }).first()).toBeVisible()
  })
})

import { expect, test } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

test.describe("@smoke Queue check-in arrival", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("booked appointment appears in queue check-in column", async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto("/patients")
    const patientLink = page.locator('table tbody a[href^="/patients/"]').first()
    if ((await patientLink.count()) === 0) {
      test.skip(true, "No patients available to book appointment")
      return
    }
    const patientLabel = (await patientLink.textContent())?.trim()
    if (!patientLabel) {
      test.skip(true, "Patient label missing")
      return
    }
    const searchTerm = patientLabel.split(" ")[0]

    await page.goto("/appointments")
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: /^Book$/i }).click()
    await expect(page.getByText("New Appointment")).toBeVisible({ timeout: 10_000 })

    await page.getByPlaceholder(/Name or phone/i).fill(searchTerm)
    const suggestionButton = page.locator("ul li button").first()
    await expect(suggestionButton).toBeVisible({ timeout: 10_000 })
    await suggestionButton.click()

    const confirmButton = page.getByRole("button", { name: /Confirm Booking/i })
    if (await confirmButton.isDisabled()) {
      test.skip(true, "No available slot for selected provider/date")
      return
    }

    await confirmButton.click()
    await expect(page.getByText(/Appointment created successfully/i)).toBeVisible({ timeout: 15_000 })

    await page.goto("/queue?focus=checkin")
    await expect(page.getByRole("heading", { name: "Queue Board" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("button", { name: /Check in to Waiting/i }).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

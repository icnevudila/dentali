import { expect, test } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

test.describe("@responsive Critical clinic surfaces", () => {
  test.beforeEach(() => requireE2eCredentials())

  for (const route of ["/", "/appointments", "/queue", "/dentist", "/patients", "/billing", "/reports"]) {
    test(`${route} keeps navigation and primary content usable`, async ({ page }) => {
      await loginAsTestUser(page)
      await page.goto(route)
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 })
      await expect(page.locator("body")).not.toContainText(/Minified React error|row-level security|permission denied for table/i)

      if (test.info().project.name !== "chromium") {
        await expect(page.getByRole("button", { name: /menu|navigation/i }).first()).toBeVisible()
        const fitsViewport = await page.locator("body").evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
        expect(fitsViewport, `${route} must not overflow horizontally`).toBe(true)
      }
    })
  }
})

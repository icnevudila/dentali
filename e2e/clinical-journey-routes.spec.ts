import { test, expect } from "@playwright/test"

/**
 * A→Z clinical journey — route smoke (no credentials required for public/unauth pages).
 * Full chain with data: see docs/GO_LIVE_SMOKE.md + e2e/automation-chain.spec.ts
 */
test.describe("Clinical journey routes", () => {
  const publicRoutes = [
    "/login",
    "/signup",
    "/pricing",
    "/quote",
    "/welcome",
    "/about",
    "/security",
    "/contact",
    "/privacy",
    "/terms",
    "/kiosk",
    "/display",
  ]

  for (const route of publicRoutes) {
    test(`${route} loads`, async ({ page }) => {
      const response = await page.goto(route)
      expect(response?.status(), `${route} should not 5xx`).toBeLessThan(500)
      await expect(page.locator("body")).not.toBeEmpty()
    })
  }

  test("staff clinical routes redirect or load without server error", async ({ page }) => {
    const staffRoutes = [
      "/patients/new",
      "/appointments",
      "/queue",
      "/dentist",
      "/billing",
      "/inventory",
      "/settings/workflow",
      "/reports/closeout",
    ]

    for (const route of staffRoutes) {
      const response = await page.goto(route)
      expect(response?.status(), `${route} should not 5xx`).toBeLessThan(500)
      await expect(page.locator("body")).not.toBeEmpty()
    }
  })
})

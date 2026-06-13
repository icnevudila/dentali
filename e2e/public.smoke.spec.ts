import { test, expect, type Page } from "@playwright/test"

async function waitForLoginForm(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" })
  // Session check shows a spinner before the form mounts
  await expect(page.locator("#login-email")).toBeVisible({ timeout: 30_000 })
}

test.describe("@smoke Public routes", () => {
  test("welcome page loads with product positioning", async ({ page }) => {
    await page.goto("/welcome", { waitUntil: "networkidle" })
    await expect(
      page.getByRole("heading", { level: 1, name: /Run your clinic on dentali/i })
    ).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("landing-start-trial")).toBeVisible()
    await expect(page.getByTestId("marketing-start-trial")).toBeVisible()
  })

  test("pricing page loads with plan tiers", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /Plans that scale/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("pricing-cta-starter")).toBeVisible()
    await expect(page.getByRole("heading", { name: /Frequently asked questions/i })).toBeVisible()
  })

  test("quote page shows request form", async ({ page }) => {
    await page.goto("/quote", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /Get a quote/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId("quote-form")).toBeVisible()
  })

  test("signup page shows registration form", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("signup-form")).toBeVisible({ timeout: 15_000 })
    await expect(page.locator("#signup-email")).toBeVisible()
  })

  test("login page shows sign-in form", async ({ page }) => {
    await waitForLoginForm(page)
    await expect(page.locator("#login-password")).toBeVisible()
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible()
  })

  test("invalid consent sign link shows error", async ({ page }) => {
    await page.goto("/sign/invalid-smoke-token", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByText(/invalid or has expired/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test("kiosk without token shows invalid link", async ({ page }) => {
    await page.goto("/kiosk", { waitUntil: "domcontentloaded" })
    await expect(page.getByText(/Invalid kiosk link/i)).toBeVisible({ timeout: 30_000 })
  })

  test("display without token shows invalid link", async ({ page }) => {
    await page.goto("/display", { waitUntil: "domcontentloaded" })
    await expect(page.getByText(/Invalid display link/i)).toBeVisible({ timeout: 30_000 })
  })

  test("display with token shows board and voice toggle", async ({ page }) => {
    const token = process.env.E2E_DISPLAY_TOKEN
    test.skip(!token, "Set E2E_DISPLAY_TOKEN for live display smoke")

    await page.goto(`/display?token=${token}&theme=light&names=1&voice=1`, {
      waitUntil: "domcontentloaded",
    })

    await expect(page.getByTestId("display-voice-toggle")).toBeVisible({ timeout: 30_000 })
    await page.getByTestId("display-voice-toggle").click()
    await expect(page.getByTestId("display-voice-toggle")).toHaveAttribute("aria-pressed", "false")

    const masked = page.locator('[data-testid="display-masked-name"]').first()
    if (await masked.count()) {
      await expect(masked).toBeVisible()
    }
  })

  test("onboarding redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/onboarding")
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })

  test("welcome sign-in CTA navigates to login", async ({ page }) => {
    await page.goto("/welcome", { waitUntil: "networkidle" })
    const cta = page.getByTestId("landing-staff-sign-in")
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
    await expect(page.locator("#login-email")).toBeVisible({ timeout: 30_000 })
  })

  test("welcome start trial navigates to signup", async ({ page }) => {
    await page.goto("/welcome", { waitUntil: "networkidle" })
    await page.getByTestId("landing-start-trial").click()
    await expect(page).toHaveURL(/\/signup/, { timeout: 15_000 })
    await expect(page.getByTestId("signup-form")).toBeVisible()
  })

  test("login learn-more link returns to welcome", async ({ page }) => {
    await waitForLoginForm(page)
    await page.getByRole("link", { name: /See what the clinic OS includes/i }).click()
    await expect(page).toHaveURL(/\/welcome/, { timeout: 10_000 })
    await expect(
      page.getByRole("heading", { level: 1, name: /Run your clinic on dentali/i })
    ).toBeVisible({
      timeout: 15_000,
    })
  })
})

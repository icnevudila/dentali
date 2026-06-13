import { expect, test, type Page } from "@playwright/test"

export const e2eEmail = process.env.E2E_TEST_EMAIL
export const e2ePassword = process.env.E2E_TEST_PASSWORD

export function requireE2eCredentials() {
  test.skip(
    !e2eEmail || !e2ePassword,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated smoke tests"
  )
}

export async function loginAsTestUser(page: Page) {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill(e2eEmail!)
  await page.getByLabel("Password").fill(e2ePassword!)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 20_000 })

  if (page.url().includes("/onboarding")) {
    test.skip(true, "Account needs onboarding — use a fully provisioned test user")
  }
}

import { test, expect } from "@playwright/test"
import { loginAsTestUser, requireE2eCredentials } from "./helpers/auth"

test.describe("@smoke Medical certificate & ortho print flow", () => {
  test.beforeEach(() => {
    requireE2eCredentials()
  })

  test("can navigate to medical certificates and ortho print views", async ({ page }) => {
    await loginAsTestUser(page)

    // Check patients registry route
    await page.goto("/patients")
    await expect(page.getByRole("heading", { name: /patients|hasta/i })).toBeVisible({
      timeout: 15_000,
    })

    // Navigate directly to public/mock medical certificate print view
    await page.goto("/patients/demo-patient/medical-certificate/print")
    await expect(page.getByText(/TIBBİ İSTİRAHAT VE MUAYENE RAPORU/i)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: /Yazdır|Print/i })).toBeVisible()

    // Navigate to ortho print view
    await page.goto("/patients/demo-patient/ortho/print")
    await expect(page.getByText(/DENTALI ORTODONTİ KLİNİK FORMU/i)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: /Yazdır/i })).toBeVisible()
  })
})

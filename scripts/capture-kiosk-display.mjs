import { chromium } from "@playwright/test"
import { resolve } from "node:path"
import { mkdir } from "node:fs/promises"

const root = resolve(import.meta.dirname, "..")
const targetDir = resolve(root, "public/screenshots/all-pages/queue")

const email = "alidduvenci@gmail.com"
const password = "ocanada12"

async function main() {
  await mkdir(targetDir, { recursive: true })
  
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  // 1. Giriş Yap (Login)
  console.log("Logging in via http://localhost:3000/login ...")
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" })
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  
  // Dashboard yüklenmesini bekle (Girişin tamamlandığını doğrular)
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 25000 })
  console.log("Logged in successfully. Navigating to kiosk/display...")

  // 2. Kiosk Ekranını Yakala (Tablet viewport)
  const kioskPage = await context.newPage({
    viewport: { width: 768, height: 1024 },
    isMobile: true,
    hasTouch: true
  })
  console.log("Navigating to http://localhost:3000/kiosk ...")
  await kioskPage.goto("http://localhost:3000/kiosk", { waitUntil: "networkidle" })
  await kioskPage.waitForTimeout(4000) // Bileşenlerin tamamen yüklenmesi için 4 saniye bekle
  
  const kioskPath = resolve(targetDir, "tablet.png")
  await kioskPage.screenshot({ path: kioskPath })
  console.log(`Saved authenticated Kiosk screenshot to ${kioskPath}`)
  await kioskPage.close()

  // 3. Sıra TV Ekranını Yakala (Desktop viewport)
  const displayPage = await context.newPage({
    viewport: { width: 1920, height: 1080 }
  })
  console.log("Navigating to http://localhost:3000/display ...")
  await displayPage.goto("http://localhost:3000/display", { waitUntil: "networkidle" })
  await displayPage.waitForTimeout(4000)
  
  const displayPath = resolve(targetDir, "desktop.png")
  await displayPage.screenshot({ path: displayPath })
  console.log(`Saved authenticated Queue Display screenshot to ${displayPath}`)
  await displayPage.close()

  await browser.close()
  console.log("All screenshots captured successfully with session!")
}

main().catch(console.error)

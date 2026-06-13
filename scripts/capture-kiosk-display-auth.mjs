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
  
  // 1. Giriş Yap
  console.log("Logging in via http://localhost:3000/login ...")
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" })
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 25000 })
  console.log("Logged in successfully. Navigating to settings/workflow to extract tokens...")

  // 2. Ayarlar sayfasından linkleri çek
  await page.goto("http://localhost:3000/settings/workflow", { waitUntil: "networkidle" })
  await page.waitForTimeout(4000)

  // Sayfadaki tüm linkleri ve data-copy attribute'ları çekelim
  const tokens = await page.evaluate(() => {
    const results = []
    // Linklerdeki href'ler
    document.querySelectorAll("a").forEach(a => {
      if (a.href) results.push(a.href)
    })
    // Butonlardaki veya inputlardaki data-copy-value veya value'lar
    document.querySelectorAll("input, button, [data-copy-value]").forEach(el => {
      const copyVal = el.getAttribute("data-copy-value")
      if (copyVal) results.push(copyVal)
      const val = el.value
      if (val && val.includes("token=")) results.push(val)
    })
    return results
  })

  console.log("Found raw URL tokens in page:", tokens)

  const kioskLink = tokens.find(t => t && t.includes("/kiosk?token="))
  const displayLink = tokens.find(t => t && t.includes("/display?token="))

  if (!kioskLink || !displayLink) {
    console.error("Could not find kiosk or display tokens in the Workflow settings page!")
    await browser.close()
    return
  }

  console.log(`Extracted Kiosk URL: ${kioskLink}`)
  console.log(`Extracted Display URL: ${displayLink}`)

  // 3. Kiosk Ekranını Yakala (Tablet viewport)
  const kioskPage = await context.newPage({
    viewport: { width: 768, height: 1024 },
    isMobile: true,
    hasTouch: true
  })
  console.log(`Navigating to kiosk...`)
  await kioskPage.goto(kioskLink, { waitUntil: "networkidle" })
  await kioskPage.waitForTimeout(4000)
  
  const kioskPath = resolve(targetDir, "tablet.png")
  await kioskPage.screenshot({ path: kioskPath })
  console.log(`Saved Kiosk screenshot with token to ${kioskPath}`)
  await kioskPage.close()

  // 4. Sıra TV Ekranını Yakala (Desktop viewport)
  const displayPage = await context.newPage({
    viewport: { width: 1920, height: 1080 }
  })
  console.log(`Navigating to display...`)
  await displayPage.goto(displayLink, { waitUntil: "networkidle" })
  await displayPage.waitForTimeout(4000)
  
  const displayPath = resolve(targetDir, "desktop.png")
  await displayPage.screenshot({ path: displayPath })
  console.log(`Saved Display screenshot with token to ${displayPath}`)
  await displayPage.close()

  await browser.close()
  console.log("Success! Authenticated kiosk & display screenshots captured.")
}

main().catch(console.error)

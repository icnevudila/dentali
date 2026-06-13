/**
 * Central print utility for the entire app.
 *
 * Problem: `window.print()` prints the ENTIRE current page (sidebar, header,
 * everything). `data:text/html` URIs are blocked by Chrome/Edge. Both are broken.
 *
 * Solution: This utility captures the target element's HTML, wraps it in a
 * clean standalone page, opens it via a Blob URL, and triggers print from there.
 */

/** Options for the print utility */
export interface PrintOptions {
  /** Page title shown in the browser tab and print header */
  title?: string
  /** Extra CSS to inject into the print page */
  extraCss?: string
  /** Whether to auto-trigger the print dialog once the page loads */
  autoPrint?: boolean
}

/**
 * Opens a clean print-ready page from raw HTML string.
 * Uses Blob URL which is never blocked by popup blockers.
 */
export function openPrintableHtml(html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")

  if (!win) {
    // Popup was blocked — use fullscreen iframe fallback
    showPrintIframe(url)
    return
  }

  win.addEventListener("load", () => {
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  })
}

/**
 * Captures a DOM element by ID, wraps it in a clean print page,
 * and opens it in a new tab. This is the go-to replacement for `window.print()`.
 */
export function printElementById(elementId: string, options: PrintOptions = {}): void {
  const el = document.getElementById(elementId)
  if (!el) {
    // Fallback: try printing the main content area
    const main = document.querySelector("main") || document.querySelector("[role='main']")
    if (main) {
      printDomNode(main as HTMLElement, options)
      return
    }
    // Last resort: print entire body content (still better than window.print)
    printDomNode(document.body, options)
    return
  }
  printDomNode(el, options)
}

/**
 * Captures a DOM node's rendered HTML and opens it in a clean print window.
 */
export function printDomNode(node: HTMLElement, options: PrintOptions = {}): void {
  const { title = document.title, extraCss = "", autoPrint = true } = options

  // Collect all stylesheets from the current page
  const styleSheets = collectPageStyles()

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeForHtml(title)}</title>
  ${styleSheets}
  <style>
    /* Print-specific overrides */
    body {
      margin: 0;
      padding: 24px 32px;
      background: #fff;
      color: #0f172a;
      font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* Hide sidebar, nav, and other non-content elements */
    nav, aside, header:not(.print-header), footer:not(.print-footer),
    [data-sidebar], [data-nav], [role="navigation"],
    .no-print { display: none !important; }

    /* Toolbar for the print page */
    .print-toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .print-toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 24px;
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .print-toolbar button:hover { background: #1e293b; }
    .print-toolbar button.outline {
      background: #fff;
      color: #0f172a;
      border: 1px solid #e2e8f0;
    }
    .print-toolbar button.outline:hover { background: #f8fafc; }

    ${extraCss}

    @media print {
      .print-toolbar { display: none !important; }
      body { padding: 12px 16px; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button class="outline" onclick="window.close()">✕ Close</button>
  </div>
  <div id="print-content">
    ${node.innerHTML}
  </div>
  ${autoPrint ? `<script>
    window.addEventListener('load', function() {
      // Small delay to let fonts/images load
      setTimeout(function() { window.print(); }, 400);
    });
  </script>` : ''}
</body>
</html>`

  openPrintableHtml(html)
}

/**
 * Simple print for the current page's main content area.
 * Replaces the broken `window.print()` calls throughout the app.
 */
export function printCurrentPage(options: PrintOptions = {}): void {
  // We've added robust @media print queries to globals.css.
  // Using native window.print() is the most reliable approach 
  // to preserve Tailwind, SVGs, and React-rendered dynamic content.
  window.print()
}

// ─── Internal helpers ───

function escapeForHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function collectPageStyles(): string {
  const parts: string[] = []

  // Inline <style> tags
  document.querySelectorAll("style").forEach((style) => {
    if (style.textContent) {
      parts.push(`<style>${style.textContent}</style>`)
    }
  })

  // Linked stylesheets (skip blob: URLs which are ephemeral)
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = (link as HTMLLinkElement).href
    if (href && !href.startsWith("blob:")) {
      parts.push(`<link rel="stylesheet" href="${href}" />`)
    }
  })

  return parts.join("\n")
}

function showPrintIframe(blobUrl: string): void {
  const iframe = document.createElement("iframe")
  iframe.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;border:none;background:#fff"
  iframe.src = blobUrl
  document.body.appendChild(iframe)

  const closeBtn = document.createElement("button")
  closeBtn.textContent = "✕ Close"
  closeBtn.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:100000;padding:10px 20px;background:#0f172a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15)"
  closeBtn.onclick = () => {
    document.body.removeChild(iframe)
    document.body.removeChild(closeBtn)
    URL.revokeObjectURL(blobUrl)
  }
  document.body.appendChild(closeBtn)
}

/**
 * Generates primary + compact odontogram SVG assets matching interactive-odontogram.svg conventions.
 * Run: node scripts/generate-odontogram-svgs.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "..", "public", "odontogram")
mkdirSync(outDir, { recursive: true })

const CROWNS = {
  molar: {
    crown:
      "M -21.0,-16.0 C -24.0,-24.0 -25.0,-26.0 -18.0,-22.0 C -23.0,-30.0 -25.0,-26.0 -25.0,-17.0 L -25.0,14.0 C -25.0,29.0 -25.0,26.0 -17.0,24.0 C -23.0,30.0 -25.0,26.0 -25.0,17.0 C -25.0,39.0 25.0,39.0 25.0,17.0 C 25.0,26.0 27.0,30.0 17.0,24.0 C 25.0,26.0 25.0,29.0 25.0,14.0 L 25.0,-17.0 C 25.0,-26.0 23.0,-30.0 18.0,-22.0 C 25.0,-26.0 24.0,-24.0 21.0,-16.0 C 17.0,-28.0 -17.0,-28.0 -21.0,-16.0 Z",
    detail: `<path class="detail" d="M -12.5,-9.4 L 12.5,9.4 M 12.5,-9.4 L -12.5,9.4"/>
<ellipse class="detail" cx="0" cy="0" rx="9.0" ry="7.3"/>`,
    scale: 0.88,
  },
  canine: {
    crown:
      "M -12.0,-16.0 C -15.0,-24.0 -16.0,-26.0 -9.0,-22.0 C -14.0,-30.0 -16.0,-26.0 -16.0,-17.0 L -16.0,14.0 C -16.0,29.0 -16.0,26.0 -8.0,24.0 C -14.0,30.0 -16.0,26.0 -16.0,17.0 C -16.0,39.0 16.0,39.0 16.0,17.0 C 16.0,26.0 18.0,30.0 8.0,24.0 C 16.0,26.0 16.0,29.0 16.0,14.0 L 16.0,-17.0 C 16.0,-26.0 14.0,-30.0 9.0,-22.0 C 16.0,-26.0 15.0,-24.0 12.0,-16.0 C 8.0,-28.0 -8.0,-28.0 -12.0,-16.0 Z",
    detail: `<path class="detail" d="M 0,-14.6 L -7.0,7.3 L 7.0,7.3 Z"/>`,
    scale: 0.92,
  },
  incisor: {
    crown:
      "M -9.0,-13.0 C -12.0,-21.0 -13.0,-23.0 -6.0,-19.0 C -11.0,-27.0 -13.0,-23.0 -13.0,-14.0 L -13.0,11.0 C -13.0,26.0 -13.0,23.0 -5.0,21.0 C -11.0,27.0 -13.0,23.0 -13.0,14.0 C -13.0,36.0 13.0,36.0 13.0,14.0 C 13.0,23.0 15.0,27.0 5.0,21.0 C 13.0,23.0 13.0,26.0 13.0,11.0 L 13.0,-14.0 C 13.0,-23.0 11.0,-27.0 6.0,-19.0 C 13.0,-23.0 12.0,-21.0 9.0,-13.0 C 5.0,-25.0 -5.0,-25.0 -9.0,-13.0 Z",
    detail: `<path class="detail" d="M -6.5,0 C -2.6,-8.3 2.6,-8.3 6.5,0"/>`,
    scale: 0.95,
  },
}

function toothType(num) {
  const d = num % 10
  if (d >= 4) return "molar"
  if (d === 3) return "canine"
  return "incisor"
}

function toothEl(num, { x, y, rot, numX, numY }) {
  const type = toothType(num)
  const { crown, detail, scale } = CROWNS[type]
  return `
    <g id="tooth-${num}" class="tooth ${type}" data-tooth="${num}" data-type="${type}" role="button" tabindex="0" aria-label="Tooth ${num}">
      <title>Tooth ${num} - ${type}</title>
      <g class="tooth-shape" transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
        <path class="crown" d="${crown}"/>
        ${detail}
      </g>
      <g class="num" transform="translate(${numX} ${numY})">
        <circle r="13"/>
        <text dy="4">${num}</text>
      </g>
    </g>`
}

const PRIMARY_LAYOUT = [
  { num: 55, x: 548, y: 318, rot: -92, numX: 543, numY: 274 },
  { num: 54, x: 532, y: 268, rot: -72, numX: 527, numY: 224 },
  { num: 53, x: 568, y: 218, rot: -52, numX: 563, numY: 174 },
  { num: 52, x: 628, y: 178, rot: -32, numX: 623, numY: 134 },
  { num: 51, x: 702, y: 158, rot: -12, numX: 697, numY: 114 },
  { num: 61, x: 818, y: 158, rot: 12, numX: 813, numY: 114 },
  { num: 62, x: 892, y: 178, rot: 32, numX: 887, numY: 134 },
  { num: 63, x: 952, y: 218, rot: 52, numX: 947, numY: 174 },
  { num: 64, x: 988, y: 268, rot: 72, numX: 983, numY: 224 },
  { num: 65, x: 972, y: 318, rot: 92, numX: 967, numY: 274 },
  { num: 85, x: 548, y: 542, rot: 92, numX: 543, numY: 586 },
  { num: 84, x: 532, y: 592, rot: 72, numX: 527, numY: 636 },
  { num: 83, x: 568, y: 642, rot: 52, numX: 563, numY: 686 },
  { num: 82, x: 628, y: 682, rot: 32, numX: 623, numY: 726 },
  { num: 81, x: 702, y: 702, rot: 12, numX: 697, numY: 746 },
  { num: 71, x: 818, y: 702, rot: -12, numX: 813, numY: 746 },
  { num: 72, x: 892, y: 682, rot: -32, numX: 887, numY: 726 },
  { num: 73, x: 952, y: 642, rot: -52, numX: 947, numY: 686 },
  { num: 74, x: 988, y: 592, rot: -72, numX: 983, numY: 636 },
  { num: 75, x: 972, y: 542, rot: -92, numX: 967, numY: 586 },
]

const SHARED_STYLE = `
    #interactive-odontogram, #interactive-primary-odontogram, #compact-odontogram { font-family: Inter, Segoe UI, Arial, sans-serif; background: #f8fafc; }
    .panel-bg { fill: #ffffff; stroke: #cbd5e1; stroke-width: 1; }
    .panel-title { font-size: 16px; font-weight: 800; text-anchor: middle; fill: #243044; letter-spacing: 1.2px; }
    .jaw-bg { fill: #ecfdf5; stroke: #99f6e4; stroke-width: 2; }
    .palate { fill: #5eead4; opacity: .28; }
    .midline { stroke: #0d9488; stroke-width: 1.6; opacity: .45; stroke-dasharray: 5 7; }
    .tooth { cursor: pointer; outline: none; }
    .tooth .crown { fill: #fffbeb; stroke: #a8a29e; stroke-width: 2.2; transition: fill .16s ease, stroke .16s ease; }
    .tooth .detail { fill: none; stroke: #92400e; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; opacity: .75; }
    .tooth .num circle { fill: #e2e8f0; stroke: #fff; stroke-width: 2; }
    .tooth .num text { font-size: 10px; font-weight: 800; fill: #0f172a; text-anchor: middle; pointer-events: none; }
    .tooth.molar .num circle { fill: #0369a1; }
    .tooth.canine .num circle { fill: #0891b2; }
    .tooth.incisor .num circle { fill: #0d9488; }
    .tooth.molar .num text, .tooth.canine .num text, .tooth.incisor .num text { fill: #fff; }
    .label { fill: #64748b; font-size: 13px; font-weight: 700; }
    .arch-label { fill: #0f766e; font-size: 16px; font-weight: 800; text-anchor: middle; }
`

function primarySvg() {
  const teeth = PRIMARY_LAYOUT.map((t) => toothEl(t.num, t)).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="interactive-primary-odontogram" xmlns="http://www.w3.org/2000/svg" viewBox="395 85 690 660" width="690" height="660" role="img" aria-labelledby="title desc">
  <title id="title">Primary Odontogram SVG</title>
  <desc id="desc">Primary FDI odontogram with clickable deciduous teeth.</desc>
  <style><![CDATA[${SHARED_STYLE}]]></style>
  <rect width="1100" height="800" fill="#f8fafc"/>
  <g id="odontogram-panel" transform="translate(405 95)">
    <rect x="0" y="0" width="665" height="650" rx="22" class="panel-bg"/>
    <text x="332" y="34" class="panel-title">PRIMARY TEETH - FDI NUMBERING</text>
    <text x="35" y="342" class="label">Patient Right</text>
    <text x="544" y="342" class="label">Patient Left</text>
    <text x="355" y="88" class="arch-label">Upper / Maxillary</text>
    <text x="355" y="595" class="arch-label">Lower / Mandibular</text>
    <g transform="translate(-405 -95)">
      <path class="jaw-bg" d="M 560 390 C 585 210, 936 210, 961 390 C 886 340, 634 340, 560 390 Z"/>
      <path class="palate" d="M 624 340 C 646 220, 874 220, 898 340 C 814 302, 709 302, 624 340 Z"/>
      <line class="midline" x1="760" y1="170" x2="760" y2="397"/>
      <path class="jaw-bg" d="M 560 470 C 634 520, 886 520, 961 470 C 936 670, 585 670, 560 470 Z"/>
      <path class="palate" d="M 624 512 C 709 552, 812 552, 898 512 C 875 655, 646 655, 624 512 Z"/>
      <line class="midline" x1="760" y1="455" x2="760" y2="707"/>
      ${teeth}
    </g>
  </g>
</svg>`
}

/** Compact permanent arch for list/summary views */
const COMPACT_PERMANENT = [
  ...[18, 17, 16, 15, 14, 13, 12, 11].map((n, i) => ({ num: n, x: 48 + i * 34, y: 28, rot: -8 + i * 2 })),
  ...[21, 22, 23, 24, 25, 26, 27, 28].map((n, i) => ({ num: n, x: 328 + i * 34, y: 28, rot: 8 - i * 2 })),
  ...[48, 47, 46, 45, 44, 43, 42, 41].map((n, i) => ({ num: n, x: 48 + i * 34, y: 132, rot: 8 - i * 2 })),
  ...[31, 32, 33, 34, 35, 36, 37, 38].map((n, i) => ({ num: n, x: 328 + i * 34, y: 132, rot: -8 + i * 2 })),
]

function compactToothEl(num, { x, y, rot }) {
  const type = toothType(num)
  const d = num % 10
  let t = type
  if (d === 4 || d === 5) t = "premolar"
  const crown =
    t === "molar"
      ? "M -8,-6 C -9,-9 -10,-10 -7,-8 L -10,-12 L -10,-5 L -10,5 C -10,11 -10,10 -6,9 L -9,12 L -10,10 L -10,5 C -10,15 10,15 10,5 C 10,10 11,12 6,9 C 10,10 10,11 10,5 L 10,-5 C 10,-10 9,-12 7,-8 C 10,-10 9,-9 8,-6 C 6,-11 -6,-11 -8,-6 Z"
      : t === "premolar"
        ? "M -6,-5 C -7,-8 -8,-9 -5,-7 L -8,-10 L -8,-4 L -8,4 C -8,10 -8,9 -4,8 L -7,10 L -8,8 L -8,4 C -8,12 8,12 8,4 C 8,8 9,10 4,8 C 8,9 8,10 8,4 L 8,-4 C 8,-9 7,-10 5,-7 C 8,-9 7,-8 6,-5 C 4,-10 -4,-10 -6,-5 Z"
        : "M -5,-5 C -6,-8 -7,-9 -4,-7 L -7,-10 L -7,-4 L -7,4 C -7,10 -7,9 -3,8 L -6,10 L -7,8 L -7,4 C -7,12 7,12 7,4 C 7,8 8,10 3,8 C 7,9 7,10 7,4 L 7,-4 C 7,-9 6,-10 4,-7 C 7,-9 6,-8 5,-5 C 3,-10 -3,-10 -5,-5 Z"

  return `
    <g id="tooth-${num}" class="tooth ${t}" data-tooth="${num}" data-type="${t}">
      <g class="tooth-shape" transform="translate(${x} ${y}) rotate(${rot})">
        <path class="crown" d="${crown}"/>
      </g>
    </g>`
}

function compactSvg() {
  const teeth = COMPACT_PERMANENT.map((t) => compactToothEl(t.num, t)).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="compact-odontogram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 168" width="640" height="168" role="img" aria-label="Compact dental chart">
  <style><![CDATA[
    #compact-odontogram { font-family: Inter, Segoe UI, Arial, sans-serif; }
    .tooth .crown { fill: #f3f4f6; stroke: #9ca3af; stroke-width: 1.2; }
    .tooth.state-decayed .crown { fill: #fecaca; stroke: #dc2626; }
    .tooth.state-restored .crown { fill: #bfdbfe; stroke: #2563eb; }
    .tooth.state-missing .crown { fill: #fef3c7; stroke: #d97706; opacity: .5; }
    .tooth.state-impacted .crown { fill: #e9d5ff; stroke: #7c3aed; }
    .tooth.state-other .crown { fill: #f1f5f9; stroke: #64748b; }
    .arch-line { stroke: #e5e7eb; stroke-width: 1; stroke-dasharray: 4 3; }
  ]]></style>
  <rect width="640" height="168" fill="#fafafa" rx="8"/>
  <line class="arch-line" x1="8" y1="84" x2="632" y2="84"/>
  <text x="320" y="14" text-anchor="middle" fill="#64748b" font-size="9" font-weight="700">UPPER</text>
  <text x="320" y="164" text-anchor="middle" fill="#64748b" font-size="9" font-weight="700">LOWER</text>
  ${teeth}
</svg>`
}

function surfaceAtlasSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="tooth-surface-atlas" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200" role="img" aria-label="Tooth surface map reference">
  <style><![CDATA[
    .panel { fill: #fff; stroke: #e2e8f0; }
    .surf { stroke: #94a3b8; stroke-width: 2; fill: #fff; }
    .surf-f { fill: #ecfdf5; }
    .surf-o { fill: #fef9c3; }
    .surf-m { fill: #eff6ff; }
    .surf-d { fill: #fdf2f8; }
    .surf-l { fill: #f5f3ff; }
    .lbl { font: 700 11px Inter, Arial, sans-serif; fill: #334155; }
    .hint { font: 500 10px Inter, Arial, sans-serif; fill: #64748b; }
  ]]></style>
  <rect class="panel" x="4" y="4" width="312" height="192" rx="12"/>
  <text x="160" y="24" class="lbl" text-anchor="middle">Surface map (molar / premolar)</text>
  <g transform="translate(160 108)">
    <path class="surf surf-f" d="M -52 -28 L 52 -28 L 38 -8 L -38 -8 Z"/>
    <text x="0" y="-16" class="lbl" text-anchor="middle">F / B</text>
    <path class="surf surf-l" d="M -52 28 L 52 28 L 38 8 L -38 8 Z"/>
    <text x="0" y="22" class="lbl" text-anchor="middle">L</text>
    <path class="surf surf-m" d="M -52 -28 L -38 -8 L -38 8 L -52 28 Z"/>
    <text x="-46" y="4" class="lbl" text-anchor="middle">M</text>
    <path class="surf surf-d" d="M 52 -28 L 38 -8 L 38 8 L 52 28 Z"/>
    <text x="46" y="4" class="lbl" text-anchor="middle">D</text>
    <path class="surf surf-o" d="M -38 -8 L 38 -8 L 38 8 L -38 8 Z"/>
    <text x="0" y="4" class="lbl" text-anchor="middle">O</text>
  </g>
  <text x="160" y="186" class="hint" text-anchor="middle">Facial/Buccal · Lingual · Mesial · Distal · Occlusal</text>
</svg>`
}

function periodontalScreeningSvg() {
  const sextants = [
    { id: "UR", label: "UR", x: 40, y: 36 },
    { id: "UA", label: "UA", x: 160, y: 36 },
    { id: "UL", label: "UL", x: 280, y: 36 },
    { id: "LR", label: "LR", x: 40, y: 148 },
    { id: "LA", label: "LA", x: 160, y: 148 },
    { id: "LL", label: "LL", x: 280, y: 148 },
  ]
  const sites = sextants
    .map(
      (s) => `
    <g class="sextant" transform="translate(${s.x} ${s.y})">
      <rect x="-36" y="-22" width="72" height="44" rx="8" class="sext-box"/>
      <text x="0" y="-28" class="sext-label" text-anchor="middle">${s.label}</text>
      <circle cx="-18" cy="0" r="5" class="site site-dfb"/>
      <circle cx="0" cy="-10" r="5" class="site site-mb"/>
      <circle cx="18" cy="0" r="5" class="site site-mfb"/>
      <circle cx="-18" cy="14" r="5" class="site site-dlb"/>
      <circle cx="0" cy="20" r="5" class="site site-lb"/>
      <circle cx="18" cy="14" r="5" class="site site-mlb"/>
    </g>`
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg id="periodontal-screening" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 200" width="360" height="200" role="img" aria-label="Periodontal six-site screening reference">
  <style><![CDATA[
    .title { font: 700 12px Inter, Arial, sans-serif; fill: #0f766e; }
    .sext-box { fill: #f0fdfa; stroke: #99f6e4; stroke-width: 1.2; }
    .sext-label { font: 700 10px Inter, Arial, sans-serif; fill: #115e59; }
    .site { fill: #fff; stroke: #14b8a6; stroke-width: 1.5; }
    .legend { font: 600 9px Inter, Arial, sans-serif; fill: #475569; }
  ]]></style>
  <text x="180" y="16" class="title" text-anchor="middle">PSR / BOP — six sites per sextant</text>
  ${sites}
  <text x="12" y="192" class="legend">DFB · MB · MFB · DLB · LB · MLB</text>
</svg>`
}

writeFileSync(join(outDir, "interactive-primary-odontogram.svg"), primarySvg(), "utf8")
writeFileSync(join(outDir, "compact-odontogram.svg"), compactSvg(), "utf8")
writeFileSync(join(outDir, "tooth-surface-atlas.svg"), surfaceAtlasSvg(), "utf8")
writeFileSync(join(outDir, "periodontal-screening.svg"), periodontalScreeningSvg(), "utf8")
console.log(
  "Wrote:",
  [
    "interactive-primary-odontogram.svg",
    "compact-odontogram.svg",
    "tooth-surface-atlas.svg",
    "periodontal-screening.svg",
  ].join(", ")
)

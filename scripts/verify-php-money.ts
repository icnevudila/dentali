/**
 * Smoke checks for PHP centavo money parsing (no float SoT).
 * Run: npx tsx scripts/verify-php-money.ts
 */
import {
  centavosToInputValue,
  centavosToPesoMajor,
  parseMoneyToCentavos,
  parseMoneyToPesoMajor,
  pesoMajorToCentavos,
} from "../src/lib/money/php-money"

const cases: Array<[string, number | null]> = [
  ["1500.50", 150050],
  ["1,500.5", 150050],
  ["₱1234.56", 123456],
  ["PHP 100", 10000],
  ["0.01", 1],
  ["0", 0],
  ["0.00", 0],
  ["₱1,000", 100000],
  ["12.345", null],
  ["abc", null],
  ["", null],
  // leftover staff-input shapes (treatment-plan / ortho / inventory)
  ["2500", 250000],
  ["99.9", 9990],
]

let failed = 0
for (const [raw, expected] of cases) {
  const got = parseMoneyToCentavos(raw)
  if (got !== expected) {
    console.error(`parseMoneyToCentavos(${JSON.stringify(raw)}) => ${got}, expected ${expected}`)
    failed += 1
  }
}

if (parseMoneyToPesoMajor("1500.50") !== 1500.5) {
  console.error("parseMoneyToPesoMajor failed")
  failed += 1
}
if (centavosToPesoMajor(1) !== 0.01) {
  console.error("centavosToPesoMajor(1) failed")
  failed += 1
}
if (centavosToInputValue(Math.floor(pesoMajorToCentavos(100.01) / 2)) !== "50.00") {
  console.error("half-balance input formatting failed")
  failed += 1
}
if (centavosToPesoMajor(0) !== 0) {
  console.error("centavosToPesoMajor(0) failed")
  failed += 1
}

if (failed > 0) {
  console.error(`FAILED (${failed})`)
  process.exit(1)
}
console.log("verify-php-money: ALL_PASS")

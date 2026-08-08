import { describe, expect, it } from "vitest"
import {
  DEFAULT_RECARE_INTERVAL_MONTHS,
  parseRecareIntervalMonths,
  resolveRecareIntervalMonthsFromSettings,
} from "./recare-interval"

describe("parseRecareIntervalMonths", () => {
  it("accepts whole numbers in range", () => {
    expect(parseRecareIntervalMonths(6)).toBe(6)
    expect(parseRecareIntervalMonths(12)).toBe(12)
    expect(parseRecareIntervalMonths("3")).toBe(3)
  })

  it("rejects out of range or invalid values", () => {
    expect(parseRecareIntervalMonths(0)).toBeNull()
    expect(parseRecareIntervalMonths(25)).toBeNull()
    expect(parseRecareIntervalMonths("")).toBeNull()
    expect(parseRecareIntervalMonths(null)).toBeNull()
    expect(parseRecareIntervalMonths(3.9)).toBe(3)
  })
})

describe("resolveRecareIntervalMonthsFromSettings", () => {
  it("falls back to clinic default when unset", () => {
    expect(resolveRecareIntervalMonthsFromSettings(null)).toBe(DEFAULT_RECARE_INTERVAL_MONTHS)
    expect(resolveRecareIntervalMonthsFromSettings({})).toBe(DEFAULT_RECARE_INTERVAL_MONTHS)
  })

  it("reads hygiene_recall_months from workflow settings", () => {
    expect(
      resolveRecareIntervalMonthsFromSettings({ hygiene_recall_months: 9 })
    ).toBe(9)
  })
})

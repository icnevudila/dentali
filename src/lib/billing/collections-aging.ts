/** Aging bucket keys aligned with get_ar_aging cutoffs (0–30 / 31–60 / 60+). */
export type CollectionsAgingBucket = "0_30" | "31_60" | "60_plus"

/** Pure helper — mirrors SQL greatest(0, today − anchor) bucket cutoffs. */
export function classifyAgingBucket(daysOutstanding: number): CollectionsAgingBucket {
  const days = Math.max(0, Math.trunc(daysOutstanding))
  if (days <= 30) return "0_30"
  if (days <= 60) return "31_60"
  return "60_plus"
}

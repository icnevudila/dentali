export type DayBucket = {
  date: string
  label: string
  value: number
}

export function buildDayRange(days: number, locale?: string): Omit<DayBucket, "value">[] {
  const result: Omit<DayBucket, "value">[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const labelOptions: Intl.DateTimeFormatOptions =
    days > 14
      ? { month: "short", day: "numeric" }
      : { weekday: "short" }

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    result.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(locale, labelOptions),
    })
  }

  return result
}

export function bucketByDate<T>(
  items: T[],
  getDateKey: (item: T) => string,
  days: number,
  locale?: string
): DayBucket[] {
  const range = buildDayRange(days, locale)
  const counts = new Map(range.map((d) => [d.date, 0]))

  for (const item of items) {
    const key = getDateKey(item)
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return range.map((d) => ({
    ...d,
    value: counts.get(d.date) ?? 0,
  }))
}

export function bucketAmountsByDate<T>(
  items: T[],
  getDateKey: (item: T) => string,
  getAmount: (item: T) => number,
  days: number,
  locale?: string
): DayBucket[] {
  const range = buildDayRange(days, locale)
  const totals = new Map(range.map((d) => [d.date, 0]))

  for (const item of items) {
    const key = getDateKey(item)
    if (totals.has(key)) {
      totals.set(key, (totals.get(key) ?? 0) + getAmount(item))
    }
  }

  return range.map((d) => ({
    ...d,
    value: totals.get(d.date) ?? 0,
  }))
}

import { createClient } from "@/lib/supabase/client"

export type SatisfactionFeedbackRow = {
  id: string
  rating: number
  feedback_text: string | null
  created_at: string
  source: string
}

export type SatisfactionSummary = {
  total: number
  average: number | null
  distribution: { rating: number; count: number }[]
  recent: SatisfactionFeedbackRow[]
}

function emptySummary(): SatisfactionSummary {
  return {
    total: 0,
    average: null,
    distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 })),
    recent: [],
  }
}

export async function fetchSatisfactionSummary(
  branchId: string,
  periodDays = 30
): Promise<{ data: SatisfactionSummary; error: string | null }> {
  const supabase = createClient()
  const since = new Date()
  since.setDate(since.getDate() - periodDays)

  const { data, error } = await supabase
    .from("patient_satisfaction_feedback")
    .select("id, rating, feedback_text, created_at, source")
    .eq("branch_id", branchId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return { data: emptySummary(), error: error.message }

  const rows = (data ?? []) as SatisfactionFeedbackRow[]
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: rows.filter((r) => Number(r.rating) === rating).length,
  }))
  const total = rows.length
  const sum = rows.reduce((acc, r) => acc + Number(r.rating || 0), 0)

  return {
    data: {
      total,
      average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
      distribution,
      recent: rows.slice(0, 50),
    },
    error: null,
  }
}

export function downloadSatisfactionCsv(rows: SatisfactionFeedbackRow[], filename: string) {
  const header = ["created_at", "rating", "source", "feedback_text"]
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        String(r.rating),
        r.source,
        JSON.stringify(r.feedback_text ?? ""),
      ].join(",")
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

import { redirect } from "next/navigation"

export default async function LegacyPdaPrintRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ branch?: string }>
}) {
  const { id } = await params
  const { branch } = await searchParams
  const query = branch ? `?branch=${encodeURIComponent(branch)}` : ""
  redirect(`/patients/${id}/pda-chart/print${query}`)
}

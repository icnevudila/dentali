import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PatientConsentsIndexPage({ params }: Props) {
  const { id } = await params
  redirect(`/patients/${id}?tab=consents`)
}

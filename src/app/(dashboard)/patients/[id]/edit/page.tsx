"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { PatientPageShell } from "@/components/patients/PatientPageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useRouteParams } from "@/hooks/use-route-params"
import { patientSchema, type PatientFormValues } from "@/lib/validations/patient"
import {
  getPatient,
  patientToFormValues,
  updatePatient,
  updatePatientIntakeProfile,
} from "@/lib/patients/patient-service"
import { MergePatientPanel } from "@/components/patients/MergePatientPanel"
import { PatientInsurancePanel } from "@/components/patients/PatientInsurancePanel"
import { PatientIntakeProfilePanel } from "@/components/patients/PatientIntakeProfilePanel"
import { emptyPatientIntakeProfile, type PatientIntakeProfile } from "@/lib/patients/patient-intake-profile"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"

export default function EditPatientPage() {
  const { id: patientId } = useRouteParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [patientName, setPatientName] = React.useState("")
  const [intakeProfile, setIntakeProfile] = React.useState<PatientIntakeProfile>(emptyPatientIntakeProfile())

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
  })

  React.useEffect(() => {
    if (!patientId) return
    getPatient(patientId).then(({ data, error }) => {
      if (error || !data) {
        setLoadError(error ?? "Patient not found")
      } else {
        form.reset(patientToFormValues(data))
        setIntakeProfile(data.intake_profile ?? emptyPatientIntakeProfile())
        setPatientName(`${data.first_name} ${data.last_name}`)
      }
      setLoading(false)
    })
  }, [patientId, form])

  const handleSave = async (values: PatientFormValues) => {
    if (!user) return
    setIsSaving(true)
    setSubmitError(null)

    const { error } = await updatePatient(patientId, values, user.id)
    if (error) {
      toast.error(error)
      setSubmitError(error)
      setIsSaving(false)
      return
    }

    const { error: intakeError } = await updatePatientIntakeProfile(patientId, intakeProfile, user.id)
    if (intakeError) {
      toast.error(intakeError)
      setSubmitError(intakeError)
      setIsSaving(false)
      return
    }

    toast.success("Patient details updated successfully")

    const org = await fetchOrganization()
    if (org) {
      await logAuditEvent({
        organizationId: org.id,
        branchId: activeBranch?.id,
        action: "patient.update",
        entityType: "patient",
        entityId: patientId,
      })
    }

    router.push(`/patients/${patientId}`)
  }

  if (loading) {
    return <PageLoadingSkeleton variant="form" />
  }

  if (loadError) {
    return (
      <PatientPageShell
        patientId={patientId}
        section="Profile"
        title="Edit patient"
        error={loadError}
        panel={false}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/patients">Back to registry</Link>
          </Button>
        }
      >
        {null}
      </PatientPageShell>
    )
  }

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
      <PatientPageShell
        patientId={patientId}
        section="Profile"
        title="Edit patient profile"
        description={patientName || "Update demographic and contact details."}
        maxWidth="max-w-4xl"
        className="pb-10"
        panel={false}
        error={submitError}
      >
        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
          <ContentPanel className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
              <CardDescription>Make changes to the core patient data.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">First Name</label>
                <Input {...form.register("firstName")} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Last Name</label>
                <Input {...form.register("lastName")} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Date of Birth</label>
                <Input type="date" {...form.register("dateOfBirth")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Gender</label>
                <select
                  {...form.register("gender")}
                  className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Phone Number</label>
                <Input {...form.register("phoneNumber")} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Email</label>
                <Input {...form.register("email")} type="email" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-neutral-900">Street Address</label>
                <Input {...form.register("addressLine1")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">City</label>
                <Input {...form.register("city")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Emergency contact name</label>
                <Input {...form.register("emergencyContactName")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Emergency contact phone</label>
                <Input {...form.register("emergencyContactPhone")} />
              </div>
            </CardContent>
          </Card>

          <PatientIntakeProfilePanel value={intakeProfile} onChange={setIntakeProfile} />

          <PatientInsurancePanel patientId={patientId} />

          <div className="flex items-center justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
          </ContentPanel>
        </form>

        <MergePatientPanel
          masterPatientId={patientId}
          masterName={patientName || "This patient"}
          onMerged={() => router.push(`/patients/${patientId}`)}
        />
      </PatientPageShell>
    </PermissionGate>
  )
}

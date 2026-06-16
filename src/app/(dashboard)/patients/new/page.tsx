"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { patientSchema, type PatientFormValues } from "@/lib/validations/patient"
import { finalizePatientIntake, detectDuplicatePatients, type DuplicateCandidate } from "@/lib/patients/patient-service"
import {
  clearIntakeDraft,
  formatDraftSavedAt,
  hasIntakeDraftContent,
  loadIntakeDraft,
  saveIntakeDraft,
  type IntakeInsuranceDraft,
} from "@/lib/patients/intake-draft"
import { upsertPatientInsuranceProfile } from "@/lib/patients/insurance-service"
import {
  labelMissingField,
  labelWarning,
  validateIntakeCompleteness,
  type IntakeValidationResult,
} from "@/lib/patients/intake-validation"
import {
  clearDraftForReview,
  loadDraftForReview,
  markIntakeDraftFinalized,
} from "@/lib/patients/intake-draft-review"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { logAuditEvent } from "@/lib/audit/audit-service"
import { useAuth } from "@/hooks/use-auth"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { ArrowLeft, UserPlus, AlertCircle, Camera, Save, Users } from "lucide-react"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { uploadPatientProfilePhoto } from "@/lib/patients/patient-documents-service"
import Link from "next/link"
import { Suspense } from "react"
import { toast } from "sonner"

const STEP_FIELDS: (keyof PatientFormValues)[][] = [
  ["firstName", "lastName", "dateOfBirth", "gender"],
  ["phoneNumber", "email", "addressLine1", "city"],
  [],
  ["emergencyContactName", "emergencyContactPhone"],
]

const INTAKE_STEP_KEYS = [
  { key: "patients.stepDemographics", fallback: "Demographics" },
  { key: "patients.stepContact", fallback: "Contact" },
  { key: "patients.stepInsurance", fallback: "Insurance" },
  { key: "patients.stepReview", fallback: "Review" },
] as const

const DEFAULT_INSURANCE: IntakeInsuranceDraft = {
  payerType: "none",
  payerName: "",
  memberId: "",
  planName: "",
}

const PAYER_LABELS: Record<IntakeInsuranceDraft["payerType"], string> = {
  none: "Self-pay",
  hmo: "HMO",
  philhealth: "PhilHealth",
  private: "Private insurance",
}

function insuranceNeedsMemberId(payerType: IntakeInsuranceDraft["payerType"]): boolean {
  return payerType === "hmo" || payerType === "philhealth" || payerType === "private"
}

export default function NewPatientPage() {
  return (
    <Suspense
      fallback={<PageLoadingSkeleton variant="form" />}
    >
      <NewPatientPageContent />
    </Suspense>
  )
}

function NewPatientPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { activeBranch } = useBranch()
  const { t } = useLocale()
  const intakeSteps = INTAKE_STEP_KEYS.map((s) => t(s.key, s.fallback))
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [duplicates, setDuplicates] = React.useState<DuplicateCandidate[]>([])
  const [draftSavedAt, setDraftSavedAt] = React.useState<string | null>(null)
  const [pendingDraft, setPendingDraft] = React.useState<ReturnType<typeof loadIntakeDraft>>(null)
  const [step, setStep] = React.useState(0)
  const [intakeValidation, setIntakeValidation] = React.useState<IntakeValidationResult | null>(null)
  const [validationLoading, setValidationLoading] = React.useState(false)
  const [kioskDraftIntakeId, setKioskDraftIntakeId] = React.useState<string | null>(null)
  const [photoFile, setPhotoFile] = React.useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [insurance, setInsurance] = React.useState<IntakeInsuranceDraft>(DEFAULT_INSURANCE)
  const [insuranceError, setInsuranceError] = React.useState<string | null>(null)
  const photoInputRef = React.useRef<HTMLInputElement>(null)

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "prefer_not_to_say",
      email: "",
      phoneNumber: "",
      addressLine1: "",
      city: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalAlerts: "",
    },
  })

  const phoneValue = form.watch("phoneNumber")
  const firstName = form.watch("firstName")
  const lastName = form.watch("lastName")
  const dateOfBirth = form.watch("dateOfBirth")
  const formValues = form.watch()

  React.useEffect(() => {
    if (searchParams.get("from") !== "kiosk-draft") return
    const review = loadDraftForReview()
    if (!review) return
    form.reset({ ...form.getValues(), ...review.values })
    setKioskDraftIntakeId(review.intakeId)
    setPendingDraft(null)
  }, [searchParams, form])

  React.useEffect(() => {
    if (!user || !activeBranch) return
    const draft = loadIntakeDraft(activeBranch.id, user.id)
    if (draft && hasIntakeDraftContent(draft.values)) {
      setPendingDraft(draft)
    }
  }, [user, activeBranch])

  React.useEffect(() => {
    if (!user || !activeBranch) return
    const t = setTimeout(() => {
      if (!hasIntakeDraftContent(formValues)) return
      const { savedAt } = saveIntakeDraft(activeBranch.id, user.id, formValues, insurance)
      setDraftSavedAt(savedAt)
    }, 1500)
    return () => clearTimeout(t)
  }, [formValues, insurance, user, activeBranch])

  const handleRestoreDraft = () => {
    if (!pendingDraft) return
    form.reset(pendingDraft.values)
    setInsurance(pendingDraft.insurance ?? DEFAULT_INSURANCE)
    setDraftSavedAt(pendingDraft.savedAt)
    setPendingDraft(null)
  }

  const handleDiscardDraft = () => {
    if (!user || !activeBranch) return
    clearIntakeDraft(activeBranch.id, user.id)
    setPendingDraft(null)
    setDraftSavedAt(null)
  }

  const handleSaveDraft = () => {
    if (!user || !activeBranch) return
    const { savedAt } = saveIntakeDraft(activeBranch.id, user.id, form.getValues(), insurance)
    setDraftSavedAt(savedAt)
    setPendingDraft(null)
  }

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await detectDuplicatePatients({
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || undefined,
        phone: phoneValue || undefined,
      })
      setDuplicates(data)
    }, 400)
    return () => clearTimeout(t)
  }, [phoneValue, firstName, lastName, dateOfBirth])

  React.useEffect(() => {
    if (step !== 3) {
      setIntakeValidation(null)
      return
    }
    setValidationLoading(true)
    validateIntakeCompleteness(form.getValues()).then(({ data, error }) => {
      setIntakeValidation(data)
      if (error) setSubmitError(error)
      setValidationLoading(false)
    })
  }, [step, formValues])

  async function onSubmit(data: PatientFormValues) {
    if (!user || !activeBranch) return
    setIsSubmitting(true)
    setSubmitError(null)

    const { data: validation, error: validationError } = await validateIntakeCompleteness(data)
    if (validationError) {
      setSubmitError(validationError)
      setIsSubmitting(false)
      return
    }
    if (validation && !validation.valid) {
      setIntakeValidation(validation)
      setSubmitError("Please complete all required fields before registering.")
      setIsSubmitting(false)
      return
    }

    if (insuranceNeedsMemberId(insurance.payerType) && !insurance.memberId.trim()) {
      setInsuranceError("Member ID is required for the selected coverage type.")
      setIsSubmitting(false)
      return
    }

    const org = await fetchOrganization()
    if (!org) {
      setSubmitError("Organization not found. Please sign in again.")
      setIsSubmitting(false)
      return
    }

    const { data: created, error } = await finalizePatientIntake(
      data,
      activeBranch.id,
      org.id
    )

    if (error || !created) {
      toast.error(error ?? "Failed to register patient")
      setSubmitError(error ?? "Failed to register patient")
      setIsSubmitting(false)
      return
    }

    await logAuditEvent({
      organizationId: org.id,
      branchId: activeBranch.id,
      action: "patient.create",
      entityType: "patient",
      entityId: created.id,
    })

    if (photoFile) {
      const { error: photoError } = await uploadPatientProfilePhoto({
        organizationId: org.id,
        branchId: activeBranch.id,
        patientId: created.id,
        file: photoFile,
      })
      if (photoError) {
        toast.error(`Patient registered but photo upload failed: ${photoError}`)
      }
    }

    if (insurance.payerType !== "none") {
      const { error: insuranceErr } = await upsertPatientInsuranceProfile({
        organizationId: org.id,
        patientId: created.id,
        payerType: insurance.payerType,
        payerName: insurance.payerName || undefined,
        memberId: insurance.memberId || undefined,
        planName: insurance.planName || undefined,
      })
      if (insuranceErr) {
        toast.error(`Patient registered but insurance save failed: ${insuranceErr}`)
      }
    }

    toast.success("Patient registered successfully")
    clearIntakeDraft(activeBranch.id, user.id)
    if (kioskDraftIntakeId) {
      await markIntakeDraftFinalized(kioskDraftIntakeId, created.id)
      clearDraftForReview()
    }
    setIsSubmitting(false)
    router.push(`/patients/${created.id}?intake=complete`)
  }

  const handleNextStep = async () => {
    if (step === 2) {
      setInsuranceError(null)
      if (insuranceNeedsMemberId(insurance.payerType) && !insurance.memberId.trim()) {
        setInsuranceError("Member ID is required for the selected coverage type.")
        return
      }
      setStep((s) => Math.min(s + 1, intakeSteps.length - 1))
      return
    }
    const fields = STEP_FIELDS[step]
    if (fields.length === 0) {
      setStep((s) => Math.min(s + 1, intakeSteps.length - 1))
      return
    }
    const valid = await form.trigger(fields)
    if (valid) setStep((s) => Math.min(s + 1, intakeSteps.length - 1))
  }

  return (
    <PermissionGate permission={PERMISSIONS.PATIENTS_WRITE}>
      <ModulePageShell
        icon={Users}
        eyebrow={`${t("patients.eyebrow", "Clinical")} · ${t("patients.intake", "Intake")}`}
        title={t("patients.registerTitle", "Register New Patient")}
        description={`Step ${step + 1} of ${intakeSteps.length} — ${intakeSteps[step]}`}
        maxWidth="max-w-4xl"
        panel={false}
        error={submitError}
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/patients" aria-label={t("patients.back", "Back to patients")}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        className="pb-10"
      >
        <div className="flex gap-2">
          {intakeSteps.map((label, i) => (
            <div
              key={label}
              className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-primary-500" : "bg-neutral-200"}`}
              title={label}
            />
          ))}
        </div>

        {kioskDraftIntakeId && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Reviewing kiosk intake submission — complete and register to finalize.
          </div>
        )}

        {pendingDraft && (
          <div className="rounded-md border border-primary-200 bg-primary-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-primary-900">
              <p className="font-medium">Saved draft found</p>
              <p className="text-primary-700 text-xs mt-0.5">
                Last saved {formatDraftSavedAt(pendingDraft.savedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDiscardDraft}>
                Discard
              </Button>
              <Button type="button" size="sm" onClick={handleRestoreDraft}>
                Restore draft
              </Button>
            </div>
          </div>
        )}

        {draftSavedAt && !pendingDraft && (
          <p className="text-xs text-neutral-500">
            Draft auto-saved {formatDraftSavedAt(draftSavedAt)}
          </p>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Demographics</CardTitle>
              <CardDescription>Basic patient identification details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center gap-4 pb-4 border-b border-neutral-100 mb-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="relative h-16 w-16 shrink-0 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center bg-neutral-50 text-neutral-400 overflow-hidden hover:border-primary-400 transition-colors"
                >
                  {photoPreview ? (
                    <Image src={photoPreview} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 2 * 1024 * 1024) {
                      setSubmitError("Photo must be 2MB or smaller.")
                      return
                    }
                    setPhotoFile(file)
                    setPhotoPreview(URL.createObjectURL(file))
                    e.target.value = ""
                  }}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-neutral-900">Patient Photo</p>
                  <p className="text-xs text-neutral-500">Optional. JPEG, PNG, or WebP — max 2MB.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 h-7 text-xs px-3"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {photoFile ? "Change photo" : "Choose file"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">First Name <span className="text-red-500">*</span></label>
                <Input {...form.register("firstName")} placeholder="Juan" />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Last Name <span className="text-red-500">*</span></label>
                <Input {...form.register("lastName")} placeholder="Dela Cruz" />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-red-500">{form.formState.errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Date of Birth <span className="text-red-500">*</span></label>
                <Input type="date" {...form.register("dateOfBirth")} />
                {form.formState.errors.dateOfBirth && (
                  <p className="text-xs text-red-500">{form.formState.errors.dateOfBirth.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Gender <span className="text-red-500">*</span></label>
                <select
                  {...form.register("gender")}
                  className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </CardContent>
          </Card>
          )}

          {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Phone Number <span className="text-red-500">*</span></label>
                <Input type="tel" {...form.register("phoneNumber")} placeholder="+63 900 000 0000" />
                {form.formState.errors.phoneNumber && (
                  <p className="text-xs text-red-500">{form.formState.errors.phoneNumber.message}</p>
                )}
                {duplicates.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                    <p className="font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Possible duplicate patient detected
                    </p>
                    <ul className="list-disc pl-4">
                      {duplicates.map((p) => (
                        <li key={p.patient_id}>
                          <Link href={`/patients/${p.patient_id}`} className="underline hover:text-amber-950">
                            {p.first_name} {p.last_name}
                          </Link>
                          {p.phone ? ` (${p.phone})` : ""}
                          <span className="text-amber-700"> · {p.match_reason.replace("_", " ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Email Address</label>
                <Input type="email" {...form.register("email")} placeholder="juan@example.com" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-neutral-900">Street Address <span className="text-red-500">*</span></label>
                <Input {...form.register("addressLine1")} placeholder="123 Ayala Ave, Brgy San Lorenzo" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">City / Municipality <span className="text-red-500">*</span></label>
                <Input {...form.register("city")} placeholder="Makati City" />
              </div>
            </CardContent>
          </Card>
          )}

          {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Insurance &amp; Coverage</CardTitle>
              <CardDescription>Optional. You can skip by leaving Self-pay selected.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-neutral-900">Coverage type</label>
                <select
                  value={insurance.payerType}
                  onChange={(e) => {
                    const payerType = e.target.value as IntakeInsuranceDraft["payerType"]
                    setInsurance((prev) => ({ ...prev, payerType }))
                    setInsuranceError(null)
                  }}
                  className="flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {(Object.keys(PAYER_LABELS) as IntakeInsuranceDraft["payerType"][]).map((key) => (
                    <option key={key} value={key}>
                      {PAYER_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              {insurance.payerType !== "none" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-900">
                      Payer / provider name
                    </label>
                    <Input
                      value={insurance.payerName}
                      onChange={(e) => setInsurance((prev) => ({ ...prev, payerName: e.target.value }))}
                      placeholder={insurance.payerType === "hmo" ? "Maxicare, Intellicare…" : "Provider name"}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-900">
                      Member ID <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={insurance.memberId}
                      onChange={(e) => {
                        setInsurance((prev) => ({ ...prev, memberId: e.target.value }))
                        setInsuranceError(null)
                      }}
                      placeholder="Member or PIN number"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-neutral-900">Plan name</label>
                    <Input
                      value={insurance.planName}
                      onChange={(e) => setInsurance((prev) => ({ ...prev, planName: e.target.value }))}
                      placeholder="Optional plan or benefit package"
                    />
                  </div>
                </>
              ) : null}

              {insuranceError ? (
                <p className="text-xs text-red-500 md:col-span-2">{insuranceError}</p>
              ) : null}
            </CardContent>
          </Card>
          )}

          {step === 3 && (
          <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Emergency Contact Name</label>
                <Input {...form.register("emergencyContactName")} placeholder="Maria Dela Cruz" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Emergency Phone</label>
                <Input type="tel" {...form.register("emergencyContactPhone")} placeholder="+63 900 111 2222" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review</CardTitle>
              <CardDescription>Confirm details before registering.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-neutral-700">
              <p><span className="font-medium">Name:</span> {formValues.firstName} {formValues.lastName}</p>
              <p><span className="font-medium">DOB:</span> {formValues.dateOfBirth || "—"} · {formValues.gender}</p>
              <p><span className="font-medium">Phone:</span> {formValues.phoneNumber || "—"}</p>
              <p><span className="font-medium">Address:</span> {formValues.addressLine1}, {formValues.city}</p>
              <p>
                <span className="font-medium">Coverage:</span>{" "}
                {insurance.payerType === "none"
                  ? "Self-pay"
                  : `${PAYER_LABELS[insurance.payerType]}${insurance.memberId ? ` · ${insurance.memberId}` : ""}`}
              </p>
              {validationLoading && (
                <p className="text-xs text-neutral-500">Validating intake…</p>
              )}
              {intakeValidation && !intakeValidation.valid && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800 text-xs space-y-1">
                  <p className="font-medium">Missing required fields:</p>
                  <ul className="list-disc pl-4">
                    {intakeValidation.missing_fields.map((f) => (
                      <li key={f}>{labelMissingField(f)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {intakeValidation && intakeValidation.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs space-y-1">
                  <p className="font-medium">Warnings:</p>
                  <ul className="list-disc pl-4">
                    {intakeValidation.warnings.map((w) => (
                      <li key={w}>{labelWarning(w)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {intakeValidation?.valid && intakeValidation.warnings.length === 0 && !validationLoading && (
                <p className="text-green-700 text-xs">Intake validation passed.</p>
              )}
              {duplicates.length > 0 && (
                <p className="text-amber-700 text-xs">Note: {duplicates.length} possible duplicate(s) flagged.</p>
              )}
            </CardContent>
          </Card>
          </>
          )}

          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" type="button" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button
                variant="outline"
                type="button"
                className="gap-2"
                disabled={!activeBranch || !user || !hasIntakeDraftContent(formValues)}
                onClick={handleSaveDraft}
              >
                <Save className="h-4 w-4" />
                Save draft
              </Button>
              {step < intakeSteps.length - 1 ? (
                <Button type="button" onClick={handleNextStep}>
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !activeBranch ||
                    validationLoading ||
                    (intakeValidation != null && !intakeValidation.valid)
                  }
                  className="gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  {isSubmitting ? "Registering..." : "Register Patient"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </ModulePageShell>
    </PermissionGate>
  )
}

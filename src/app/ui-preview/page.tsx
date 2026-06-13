import { notFound } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/PageHeader"
import { MetricStrip } from "@/components/layout/MetricStrip"
import { RecordRow, patientInitials } from "@/components/layout/RecordRow"
import { ContentPanel } from "@/components/layout/ContentPanel"
import { SectionEyebrow } from "@/components/layout/SectionEyebrow"
import { SmsPreviewBubble, VariableChips } from "@/components/notifications/SmsPreviewBubble"
import { ConsentPreviewFrame } from "@/components/consent/ConsentPreviewFrame"
import { ConsentFormRenderer } from "@/components/consent/ConsentFormRenderer"
import { StatusPipeline, consentPipelineSteps, waitlistPipelineSteps } from "@/components/visual/StatusPipeline"
import { CompletionRing } from "@/components/visual/CompletionRing"
import { MiniOdontogram } from "@/components/odontogram/MiniOdontogram"
import { DEFAULT_GENERAL_TREATMENT_FIELDS } from "@/lib/consent/consent-field-types"
import type { ToothFinding } from "@/lib/types/dental"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Users,
  Calendar,
  Clock,
  FileWarning,
  MessageSquare,
  FileText,
  Search,
  Plus,
  MapPin,
  Sparkles,
} from "lucide-react"

const SAMPLE_FINDINGS: ToothFinding[] = [
  { tooth_number: "16", dentition_type: "permanent", condition: "decayed", surfaces: ["center"], status: "active" },
  { tooth_number: "26", dentition_type: "permanent", restoration_type: "composite", surfaces: ["top"], status: "active" },
  { tooth_number: "36", dentition_type: "permanent", condition: "missing_other", surfaces: [], status: "active" },
]

const SAMPLE_PATIENTS = [
  { id: "a1b2c3d4", first: "Maria", last: "Santos", phone: "0917 123 4567", dob: "1990-03-15", status: "active" as const },
  { id: "e5f6g7h8", first: "Juan", last: "Reyes", phone: "0928 555 0192", dob: "1985-11-02", status: "active" as const },
  { id: "i9j0k1l2", first: "Ana", last: "Cruz", phone: "—", dob: "2001-07-22", status: "inactive" as const },
]

const SMS_BODY =
  "Hi Maria Santos, a slot opened at Smile Dental QC on June 10, 2026 at 2:30 PM. Please call us to confirm your appointment."

const CONSENT_BODY = `I understand the nature of the dental procedure described to me and the risks involved.

I authorize Smile Dental QC to perform the treatment discussed during my consultation.

I confirm that I have had the opportunity to ask questions and that they were answered to my satisfaction.`

export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white shadow-sm">
              d.
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-950">dentali. UI Preview</p>
              <p className="text-xs text-neutral-500">Faz 2 polish — development only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-normal">
              <Sparkles className="h-3 w-3 text-primary-500" />
              Polished components
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Open real app</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        <ContentPanel padding="lg" className="space-y-6">
          <SectionEyebrow icon={Users}>Clinical · Patients</SectionEyebrow>
          <PageHeader
            eyebrow="Registry"
            title="Patient Registry"
            description="Manage patient records, demographics, and clinical files."
            actions={
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                New Patient
              </Button>
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="gap-1 font-normal">
              <MapPin className="h-3 w-3" />
              Main Branch — QC
            </Badge>
            <Badge variant="outline" className="font-normal">
              42 active records
            </Badge>
          </div>

          <MetricStrip
            items={[
              { label: "Patients in registry", value: 42, hint: "Organization-wide", icon: Users },
              { label: "This page", value: 3, hint: "Showing sample rows" },
              { label: "Pending intake", value: 1, hint: "Draft on branch", variant: "warning" },
            ]}
          />

          <div className="space-y-3 border-t border-neutral-100 pt-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                readOnly
                value=""
                placeholder="Search by name or phone number…"
                className="border-neutral-200 bg-neutral-50/80 pl-9 shadow-sm"
              />
            </div>
            <div className="space-y-2.5">
              {SAMPLE_PATIENTS.map((p) => (
                <RecordRow
                  key={p.id}
                  href="#"
                  initials={patientInitials(p.first, p.last)}
                  primary={`${p.first} ${p.last}`}
                  secondary={[p.phone, p.dob].filter((x) => x !== "—").join(" · ") || "—"}
                  meta={<Badge variant={p.status === "active" ? "success" : "default"}>{p.status}</Badge>}
                  trailing={
                    <div className="hidden sm:flex items-center gap-2">
                      <CompletionRing value={p.status === "active" ? 92 : 45} size={34} />
                      <MiniOdontogram findings={p.first === "Maria" ? SAMPLE_FINDINGS : []} size="sm" />
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        </ContentPanel>

        <ContentPanel padding="lg" className="space-y-5">
          <SectionEyebrow icon={Calendar}>Overview · Dashboard</SectionEyebrow>
          <PageHeader title="Dashboard" description="Main Branch — clinic overview" />
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Today&apos;s flow</p>
            <MetricStrip
              items={[
                { label: "Today's Appointments", value: 12, hint: "Scheduled today", icon: Calendar },
                { label: "Queue Waiting", value: 4, hint: "Front desk board", icon: Clock },
                { label: "Pending Consents", value: 2, hint: "Awaiting signature", icon: FileWarning },
              ]}
            />
          </div>
        </ContentPanel>

        <div className="grid gap-6 lg:grid-cols-2">
          <ContentPanel padding="lg" className="space-y-4">
            <SectionEyebrow icon={MessageSquare}>Operations · Notifications</SectionEyebrow>
            <p className="text-sm text-neutral-600">Appointment reminder template</p>
            <VariableChips variables={["patient_name", "clinic_name", "slot_date", "slot_time"]} />
            <SmsPreviewBubble body={SMS_BODY} label="Live SMS preview" />
          </ContentPanel>

          <ContentPanel padding="lg" className="space-y-4">
            <SectionEyebrow icon={FileText}>Compliance · Consent</SectionEyebrow>
            <StatusPipeline steps={consentPipelineSteps("pending")} className="max-w-sm" />
            <p className="text-sm text-neutral-600">Fillable fields + paper preview</p>
            <ConsentFormRenderer
              fields={DEFAULT_GENERAL_TREATMENT_FIELDS.slice(0, 2)}
              values={{}}
              onChange={() => {}}
            />
            <ConsentPreviewFrame
              title="Informed Consent for Dental Treatment"
              body={CONSENT_BODY}
              version="1.2"
              clinicName="Smile Dental QC"
            />
          </ContentPanel>
        </div>

        <ContentPanel padding="lg" className="space-y-4">
          <SectionEyebrow icon={Sparkles}>Visual system</SectionEyebrow>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-500">Consent pipeline</p>
              <StatusPipeline steps={consentPipelineSteps("pending")} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-500">Waitlist</p>
              <StatusPipeline steps={waitlistPipelineSteps("contacted")} />
            </div>
            <div className="space-y-2 flex flex-col items-start">
              <p className="text-xs font-medium text-neutral-500">Intake + chart</p>
              <div className="flex items-center gap-3">
                <CompletionRing value={78} />
                <MiniOdontogram findings={SAMPLE_FINDINGS} size="md" />
              </div>
            </div>
          </div>
        </ContentPanel>

        <p className="pb-6 text-center text-xs text-neutral-400">
          Gradient yok, neon yok — sadece hiyerarşi, gölge ve klinik teal. Beğenirsen gerçek sayfalara uygularız.
        </p>
      </div>
    </div>
  )
}

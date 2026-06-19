export type DeviceVariant = "desktop" | "tablet" | "mobile" | "tv"

export type WorkflowStageId =
  | "dashboard"
  | "patients"
  | "chart"
  | "appointments"
  | "kiosk"
  | "display"
  | "billing"

export const WORKFLOW_STAGES = [
  {
    id: "dashboard" as const,
    step: "01",
    title: "Clinic command center",
    subtitle: "Web · Desktop & tablet",
    description:
      "Owners and front desk see today's appointments, queue depth, pending consents, and low-stock alerts — branch-aware from the first login.",
    device: "desktop" as const,
  },
  {
    id: "patients" as const,
    step: "02",
    title: "Patient registry & intake",
    subtitle: "Web · Searchable records",
    description:
      "Register walk-ins and returning patients, capture demographics, insurance, and intake drafts without losing paper-form completeness.",
    device: "desktop" as const,
  },
  {
    id: "chart" as const,
    step: "03",
    title: "Dental chart & treatment plan",
    subtitle: "Web · Chair-side clinical",
    description:
      "FDI odontogram, tooth findings, treatment plans, and clinical notes stay linked to the same patient profile your billing team uses.",
    device: "desktop" as const,
  },
  {
    id: "appointments" as const,
    step: "04",
    title: "Appointments & waitlist",
    subtitle: "Web · Scheduling desk",
    description:
      "Chair calendars, provider availability, SMS reminders, and waitlist callbacks — built for busy reception desks.",
    device: "tablet" as const,
  },
  {
    id: "kiosk" as const,
    step: "05",
    title: "Kiosk check-in",
    subtitle: "Tablet · Patient-facing",
    description:
      "Patients check in at the branch tablet, confirm contact details, and receive a queue number — no raw errors on screen.",
    device: "tablet" as const,
  },
  {
    id: "display" as const,
    step: "06",
    title: "Queue display board",
    subtitle: "TV · Waiting room",
    description:
      "Large-format queue codes for the waiting area. Now serving and up next — calm typography, no PHI beyond first names.",
    device: "tv" as const,
  },
  {
    id: "billing" as const,
    step: "07",
    title: "Billing, HMO & PhilHealth prep",
    subtitle: "Web · Finance desk",
    description:
      "Invoices in PHP minor units, payment ledger, HMO claim tracking, and PhilHealth eClaims readiness with audit-friendly records.",
    device: "desktop" as const,
  },
] as const

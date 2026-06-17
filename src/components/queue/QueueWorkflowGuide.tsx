"use client"

import Link from "next/link"
import { CalendarCheck, ClipboardList, Receipt, Stethoscope, UserPlus, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"

export function QueueWorkflowGuide() {
  const { t } = useLocale()

  const steps = [
    {
      icon: CalendarCheck,
      title: t("queue.flowScheduledTitle", "Scheduled patient"),
      body: t(
        "queue.flowScheduledBody",
        "Appears in Check-in on appointment day. Front desk confirms arrival and moves them to Waiting."
      ),
    },
    {
      icon: Users,
      title: t("queue.flowRegisteredWalkInTitle", "Registered walk-in"),
      body: t(
        "queue.flowRegisteredWalkInBody",
        "Use Patient arrival to search an existing file, add the reason, and check in to Waiting."
      ),
    },
    {
      icon: UserPlus,
      title: t("queue.flowNewWalkInTitle", "New walk-in"),
      body: t(
        "queue.flowNewWalkInBody",
        "Create the patient file first. The form returns here with the patient selected for check-in."
      ),
    },
    {
      icon: Stethoscope,
      title: t("queue.flowDentistTitle", "Dentist handoff"),
      body: t(
        "queue.flowDentistBody",
        "Move patients Waiting → Called → In Chair on the board. Clinical notes and chart open from the dentist workspace."
      ),
    },
    {
      icon: Receipt,
      title: t("queue.flowCheckoutTitle", "Served & billing"),
      body: t(
        "queue.flowCheckoutBody",
        "Mark Served when treatment ends. Workflow can draft an invoice; collect payment in Billing, then close the visit."
      ),
    },
  ]

  return (
    <Card className="border-primary-100 bg-primary-50/35 shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" className="gap-1">
                <ClipboardList className="h-3 w-3" aria-hidden />
                {t("queue.flowBadge", "Front desk rule")}
              </Badge>
              <p className="text-sm font-semibold text-neutral-900">
                {t("queue.flowTitle", "Every physical arrival is checked in from Queue.")}
              </p>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {t(
                "queue.flowSubtitle",
                "Check-in opens the visit, creates the queue card, and places the patient in Waiting. Appointment booking alone is not a clinic arrival."
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/appointments">
                {t("queue.flowBookAppointment", "Book appointment")}
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dentist">
                {t("queue.flowOpenDentist", "Open dentist board")}
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="rounded-xl border border-white/80 bg-white/80 p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600">{step.body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

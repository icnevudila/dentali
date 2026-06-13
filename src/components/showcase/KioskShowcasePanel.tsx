"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { QueueEntry } from "@/lib/queue/queue-service"

type KioskShowcasePanelProps = {
  branchName: string
}

/** Same surface as `/kiosk` welcome step — for landing/showcase only. */
export function KioskShowcasePanel({ branchName }: KioskShowcasePanelProps) {
  const { t } = useLocale()

  return (
    <div className="flex h-full min-h-[480px] flex-col bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-6 text-white">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col justify-center">
        <div className="rounded-2xl bg-white p-8 text-neutral-900 text-center shadow-xl space-y-6">
          <p className="text-sm font-medium text-primary-600 uppercase tracking-wide">
            {t("kiosk.welcomeTo", "Welcome to")}
          </p>
          <h1 className="text-3xl font-bold">{branchName}</h1>
          <p className="text-lg text-neutral-600">
            {t("kiosk.checkInPrompt", "Tap below to check in for your appointment.")}
          </p>
          <div className="space-y-3">
            <Button size="lg" className="w-full h-16 text-xl" type="button" tabIndex={-1}>
              {t("kiosk.checkInNow", "Check in now")}
            </Button>
            <Button size="lg" variant="outline" className="w-full h-14 text-lg" type="button" tabIndex={-1}>
              {t("kiosk.newPatient", "New patient registration")}
            </Button>
          </div>
          <Link href="/login" className="block text-sm text-neutral-400 hover:text-neutral-600">
            {t("kiosk.staffLogin", "Staff login")}
          </Link>
        </div>
      </div>
    </div>
  )
}

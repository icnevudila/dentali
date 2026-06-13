"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/hooks/use-locale"
import type { PatientRecord } from "@/lib/patients/patient-service"
import { cn } from "@/lib/utils"
import {
  Calendar,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Phone,
  UserRound,
} from "lucide-react"

interface PatientRowActionsProps {
  patient: PatientRecord
  className?: string
}

export function PatientRowActions({ patient, className }: PatientRowActionsProps) {
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const stopNav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const phoneDigits = patient.phone?.replace(/\D/g, "") ?? ""

  return (
    <div ref={rootRef} className={cn("relative", className)} onClick={stopNav}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-neutral-400 hover:text-neutral-700"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("patients.rowActions", "Patient actions")}
        onClick={(e) => {
          stopNav(e)
          setOpen((v) => !v)
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-neutral-200/90 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.1)] animate-fade-rise"
        >
          <MenuLink
            href={`/patients/${patient.id}`}
            icon={UserRound}
            onNavigate={() => setOpen(false)}
          >
            {t("patients.actionProfile", "Open profile")}
          </MenuLink>
          <MenuLink
            href={`/patients/${patient.id}/edit`}
            icon={Pencil}
            onNavigate={() => setOpen(false)}
          >
            {t("patients.actionEdit", "Edit demographics")}
          </MenuLink>
          <MenuLink
            href={`/appointments`}
            icon={Calendar}
            onNavigate={() => setOpen(false)}
          >
            {t("patients.actionAppointment", "Schedule visit")}
          </MenuLink>
          {phoneDigits ? (
            <a
              role="menuitem"
              href={`tel:${phoneDigits}`}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => setOpen(false)}
            >
              <Phone className="h-4 w-4 text-neutral-400" aria-hidden />
              {t("patients.actionCall", "Call patient")}
            </a>
          ) : null}
          <MenuLink
            href={`/queue`}
            icon={ExternalLink}
            onNavigate={() => setOpen(false)}
          >
            {t("patients.actionQueue", "Go to queue")}
          </MenuLink>
        </div>
      ) : null}
    </div>
  )
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  onNavigate: () => void
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
      onClick={onNavigate}
    >
      <Icon className="h-4 w-4 text-neutral-400" aria-hidden />
      {children}
    </Link>
  )
}

"use client"

import * as React from "react"
import { createPortal } from "react-dom"
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

const MENU_WIDTH = 176

interface PatientRowActionsProps {
  patient: PatientRecord
  className?: string
  listContext?: "registry" | "daily"
}

export function PatientRowActions({ patient, className, listContext = "registry" }: PatientRowActionsProps) {
  const { t } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties>({})
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const updateMenuPosition = React.useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const margin = 8
    let left = rect.right - MENU_WIDTH
    left = Math.max(margin, Math.min(left, window.innerWidth - MENU_WIDTH - margin))

    const belowTop = rect.bottom + 4
    const menuHeightEstimate = 220
    const top =
      belowTop + menuHeightEstimate > window.innerHeight - margin
        ? Math.max(margin, rect.top - menuHeightEstimate - 4)
        : belowTop

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: MENU_WIDTH,
      zIndex: 250,
    })
  }, [])

  React.useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  const stopNav = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const phoneDigits = patient.phone?.replace(/\D/g, "") ?? ""

  const menu =
    open && mounted ? (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[240] cursor-default bg-black/20 sm:bg-transparent"
          aria-label={t("common.close", "Close")}
          onClick={() => setOpen(false)}
        />
        <div
          role="menu"
          style={menuStyle}
          className="overflow-hidden rounded-xl border border-neutral-200/90 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.14)] animate-fade-rise"
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
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100"
              onClick={() => setOpen(false)}
            >
              <Phone className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              {t("patients.actionCall", "Call patient")}
            </a>
          ) : null}
          {listContext === "registry" ? (
            <MenuLink href={`/queue`} icon={ExternalLink} onNavigate={() => setOpen(false)}>
              {t("patients.actionQueue", "Go to queue")}
            </MenuLink>
          ) : null}
        </div>
      </>
    ) : null

  return (
    <div className={cn(className)} onClick={stopNav}>
      <Button
        ref={buttonRef}
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
      {menu ? createPortal(menu, document.body) : null}
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
      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100"
      onClick={onNavigate}
    >
      <Icon className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      {children}
    </Link>
  )
}

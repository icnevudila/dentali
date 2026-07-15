"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { NAV_BACK_TRANSITION } from "@/lib/navigation/view-transition"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type BackToPatientProfileProps = {
  patientId: string
  /** Override target (e.g. chart). Defaults to patient profile. */
  href?: string
  label?: string
  className?: string
  /** Compact text link instead of button */
  variant?: "button" | "link"
}

export function BackToPatientProfile({
  patientId,
  href,
  label,
  className,
  variant = "button",
}: BackToPatientProfileProps) {
  const { t } = useLocale()
  const to = href ?? `/patients/${patientId}`
  const text =
    label ??
    (href
      ? t("patients.back", "Back")
      : t("patients.backToProfile", "Back to patient profile"))

  if (variant === "link") {
    return (
      <Link
        href={to}
        transitionTypes={NAV_BACK_TRANSITION}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800",
          className
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {text}
      </Link>
    )
  }

  return (
    <Button variant="outline" size="sm" className={cn("gap-1.5 bg-white shadow-sm", className)} asChild>
      <Link href={to} transitionTypes={NAV_BACK_TRANSITION}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {text}
      </Link>
    </Button>
  )
}

"use client"

import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { useLocale } from "@/hooks/use-locale"
import { cn } from "@/lib/utils"

type AuthFieldProps = {
  id: string
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  autoComplete?: string
  minLength?: number
  className?: string
  labelAction?: React.ReactNode
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  minLength,
  className,
  labelAction,
}: AuthFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
        {labelAction}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="auth-input w-full rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/15"
      />
    </div>
  )
}

type AuthPasswordFieldProps = Omit<AuthFieldProps, "type" | "labelAction"> & {
  labelAction?: React.ReactNode
}

export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  minLength,
  className,
  labelAction,
}: AuthPasswordFieldProps) {
  const { t } = useLocale()
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          className="auth-input w-full rounded-xl border border-neutral-200/90 bg-neutral-50/80 py-3 pl-4 pr-11 text-sm text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/15"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          aria-label={
            visible
              ? t("login.hidePassword", "Hide password")
              : t("login.showPassword", "Show password")
          }
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  )
}

export function AuthErrorAlert({ message }: { message: string }) {
  return (
    <div
      key={message}
      role="alert"
      className="auth-error-shake rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-center text-xs font-medium text-red-600"
    >
      {message}
    </div>
  )
}

export function AuthCardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-neutral-100 pt-4 text-center text-sm">{children}</div>
  )
}

export function AuthMarketingLinks() {
  const { t } = useLocale()

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-medium text-neutral-500">
      <Link href="/pricing" className="transition hover:text-primary-600">
        {t("marketing.navPricing", "Pricing")}
      </Link>
      <Link href="/quote" className="transition hover:text-primary-600">
        {t("marketing.navQuote", "Get a quote")}
      </Link>
      <Link href="/welcome" className="transition hover:text-primary-600">
        {t("login.learnMore", "See what the clinic OS includes")}
      </Link>
    </div>
  )
}

export function authFormCardClassName() {
  return cn(
    "auth-form-card mx-auto w-full max-w-[400px] space-y-7 rounded-2xl border border-neutral-200/90 border-t-[3px] border-t-emerald-500 bg-white p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]",
    "max-lg:ring-1 max-lg:ring-primary-100/80",
    "sm:rounded-3xl sm:p-8 sm:shadow-[0_16px_48px_-16px_rgba(15,23,42,0.14)]",
    "landing-hero-enter"
  )
}

export function authPrimaryButtonClassName() {
  return cn(
    "auth-btn-shine w-full rounded-xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition duration-200",
    "hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/30 active:scale-[0.98] disabled:opacity-50"
  )
}

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
}: AuthFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
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

export function authFormCardClassName() {
  return cn(
    "auth-form-card w-full max-w-[440px] space-y-7 rounded-2xl border border-neutral-200/70 bg-white/95 p-6 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm",
    "sm:rounded-3xl sm:p-8 sm:shadow-[0_20px_50px_-20px_rgba(15,23,42,0.18)]",
    "landing-hero-enter"
  )
}

export function authPrimaryButtonClassName() {
  return "w-full rounded-xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition duration-200 hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/30 active:scale-[0.98] disabled:opacity-50"
}

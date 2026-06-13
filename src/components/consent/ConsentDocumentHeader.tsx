import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export function ConsentDocumentHeader({
  title,
  orgName,
  branchName,
  patientName,
  patientDob,
  version,
  className,
}: {
  title: string
  orgName?: string
  branchName?: string
  patientName?: string
  patientDob?: string
  version?: string
  className?: string
}) {
  const clinicLine = branchName?.trim() || orgName?.trim() || "Dental clinic"
  const orgOnly = orgName?.trim() && branchName?.trim() && orgName !== branchName

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-xl border border-neutral-200/90 bg-white px-5 py-4 text-center shadow-[0_1px_0_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary-500" aria-hidden />
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 pt-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-600">
          <FileText className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
          {clinicLine}
        </p>
        {orgOnly ? (
          <p className="text-[11px] text-neutral-500">{orgName}</p>
        ) : null}
        <h2 className="text-base font-semibold tracking-tight text-neutral-950 sm:text-lg">{title}</h2>
        {(patientName || patientDob || version) && (
          <dl className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
            {patientName ? (
              <>
                <dt className="sr-only">Patient</dt>
                <dd>{patientName}</dd>
              </>
            ) : null}
            {patientDob ? (
              <>
                <dt className="sr-only">Date of birth</dt>
                <dd>DOB {patientDob}</dd>
              </>
            ) : null}
            {version ? (
              <>
                <dt className="sr-only">Version</dt>
                <dd className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px]">v{version}</dd>
              </>
            ) : null}
          </dl>
        )}
        <div className="mt-2 h-px w-full max-w-xs bg-neutral-200" aria-hidden />
      </div>
    </header>
  )
}

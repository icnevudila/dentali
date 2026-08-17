"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function MedicalCertificatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Medical certificates error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-center space-y-3">
      <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
        An Error Occurred While Loading Medical Certificates
      </h3>
      <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md">
        {error.message || "A problem occurred while processing your request. Please try again."}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Try Again</span>
      </button>
    </div>
  )
}

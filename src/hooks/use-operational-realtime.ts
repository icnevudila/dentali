"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { dispatchOperationalRefresh } from "@/lib/operational/operational-events"
import { useLocale } from "@/hooks/use-locale"

const OPERATIONAL_TABLES = ["patient_intakes", "queue_entries", "appointments"] as const
type OperationalTable = (typeof OPERATIONAL_TABLES)[number]

const TOAST_DEBOUNCE_MS = 2000

type ToastConfig = {
  message: string
  actionLabel: string
  href: string
}

function tableToastConfig(
  table: OperationalTable,
  t: (key: string, fallback: string) => string
): ToastConfig {
  switch (table) {
    case "patient_intakes":
      return {
        message: t("ops.toastIntake", "New patient intake draft submitted"),
        actionLabel: t("ops.toastIntakeAction", "Review"),
        href: "/patients?attention=intake",
      }
    case "queue_entries":
      return {
        message: t("ops.toastQueue", "Patient checked in to queue"),
        actionLabel: t("ops.toastQueueAction", "Open queue"),
        href: "/queue",
      }
    case "appointments":
      return {
        message: t("ops.toastAppointment", "New appointment activity"),
        actionLabel: t("ops.toastAppointmentAction", "View calendar"),
        href: "/appointments",
      }
  }
}

/** Global branch-scoped realtime toasts + operational refresh dispatch. */
export function useOperationalRealtime(branchId: string | undefined) {
  const router = useRouter()
  const { t } = useLocale()
  const lastToastRef = React.useRef<Record<string, number>>({})

  const showDebouncedToast = React.useCallback(
    (table: OperationalTable) => {
      const now = Date.now()
      const last = lastToastRef.current[table] ?? 0
      if (now - last < TOAST_DEBOUNCE_MS) return
      lastToastRef.current[table] = now

      const config = tableToastConfig(table, t)
      toast.info(config.message, {
        duration: 5000,
        action: {
          label: config.actionLabel,
          onClick: () => router.push(config.href),
        },
      })
    },
    [router, t]
  )

  React.useEffect(() => {
    if (!branchId) return

    const supabase = createClient()
    let channel = supabase.channel(`operational-ops-${branchId}`)

    for (const table of OPERATIONAL_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          dispatchOperationalRefresh([table])
          showDebouncedToast(table)
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, showDebouncedToast])
}

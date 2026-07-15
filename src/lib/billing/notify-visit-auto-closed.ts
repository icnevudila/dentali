import { notify } from "@/lib/ui/notify"

type Translate = (key: string, fallback: string) => string

/**
 * Staff-facing feedback when workflow automation closes today’s visit after settlement.
 * Separated from the payment toast so it is hard to miss (longer duration).
 */
export function notifyVisitAutoClosed(t: Translate) {
  notify.success(t("billing.encounterAutoClosedTitle", "Today’s visit closed"), {
    description: t(
      "billing.encounterAutoClosed",
      "Balance is settled — the visit was closed automatically. The patient no longer appears on the open-visit list."
    ),
    duration: 9000,
  })
}

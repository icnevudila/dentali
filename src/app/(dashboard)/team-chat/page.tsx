"use client"

import * as React from "react"
import { MessageSquare, RefreshCw, Send } from "lucide-react"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { ModulePageShell } from "@/components/layout/ModulePageShell"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"
import { DirectionalTransition } from "@/components/layout/DirectionalTransition"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useBranch } from "@/hooks/use-branch"
import { useLocale } from "@/hooks/use-locale"
import { fetchOrganization } from "@/lib/auth/auth-service"
import { PERMISSIONS } from "@/lib/auth/permissions"
import {
  fetchStaffMessages,
  postStaffMessage,
  type StaffMessage,
} from "@/lib/staff/staff-messages-service"
import { notify } from "@/lib/ui/notify"

const STAFF_OPS_ACCESS = [
  PERMISSIONS.QUEUE_MANAGE,
  PERMISSIONS.APPOINTMENTS_READ,
  PERMISSIONS.PATIENTS_READ,
  PERMISSIONS.STAFF_MANAGE,
] as const

export default function TeamChatPage() {
  const { activeBranch } = useBranch()
  const { t, locale } = useLocale()
  const [messages, setMessages] = React.useState<StaffMessage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  const dateLocale = locale === "tr" ? "tr-PH" : locale === "fil" ? "fil-PH" : "en-PH"

  const load = React.useCallback(async () => {
    if (!activeBranch) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await fetchStaffMessages(activeBranch.id)
    setMessages(res.data)
    setError(res.error)
    setLoading(false)
  }, [activeBranch])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeBranch || !draft.trim()) return

    const org = await fetchOrganization()
    if (!org) {
      notify.error(t("common.orgNotFound", "Organization not found"))
      return
    }

    setSending(true)
    const res = await postStaffMessage({
      organizationId: org.id,
      branchId: activeBranch.id,
      body: draft,
    })
    setSending(false)

    if (res.error || !res.data) {
      notify.error(res.error ?? t("teamChat.sendFailed", "Could not send message"))
      return
    }

    setDraft("")
    setMessages((prev) => [...prev, res.data!])
  }

  return (
    <PermissionGate anyOf={[...STAFF_OPS_ACCESS]}>
      <DirectionalTransition>
        <ModulePageShell
          eyebrow={t("teamChat.eyebrow", "Operations")}
          icon={MessageSquare}
          title={t("nav.teamChat", "Team chat")}
          description={t(
            "teamChat.description",
            "Branch-only staff messages for quick coordination during clinic hours."
          )}
          actions={
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              {t("common.refresh", "Refresh")}
            </Button>
          }
        >
          {!activeBranch ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-neutral-500">
                {t("teamChat.noBranch", "Select an active branch to view team chat.")}
              </CardContent>
            </Card>
          ) : loading ? (
            <PageLoadingSkeleton variant="detail" />
          ) : error ? (
            <Card className="border-red-200 bg-red-50/60">
              <CardContent className="py-6">
                <p className="text-sm text-red-700">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                  {t("common.retry", "Retry")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{activeBranch.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  ref={listRef}
                  className="max-h-[min(52vh,28rem)] space-y-3 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/60 p-3"
                >
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-neutral-500">
                      {t("teamChat.empty", "No messages yet. Start the conversation for this branch.")}
                    </p>
                  ) : (
                    messages.map((message) => (
                      <article key={message.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                          <span className="font-medium text-neutral-700">{message.author_name}</span>
                          <time dateTime={message.created_at}>
                            {new Date(message.created_at).toLocaleString(dateLocale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{message.body}</p>
                      </article>
                    ))
                  )}
                </div>

                <form onSubmit={(e) => void handleSend(e)} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("teamChat.placeholder", "Message the team…")}
                    maxLength={2000}
                    disabled={sending}
                  />
                  <Button type="submit" className="gap-2 sm:shrink-0" disabled={sending || !draft.trim()}>
                    <Send className="h-4 w-4" aria-hidden />
                    {sending ? t("common.saving", "Saving…") : t("teamChat.send", "Send")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </ModulePageShell>
      </DirectionalTransition>
    </PermissionGate>
  )
}

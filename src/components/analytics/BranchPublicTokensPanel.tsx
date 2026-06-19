"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link2, Trash2, ShieldAlert, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/hooks/use-locale"
import {
  listBranchPublicTokens,
  revokeBranchPublicToken,
  revokeStaleBranchPublicTokens,
  type BranchPublicTokenRow,
  type PublicTokenType,
} from "@/lib/kiosk/public-token-service"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<PublicTokenType, { key: string; fallback: string }> = {
  display: { key: "display.tokenTypeTv", fallback: "TV display" },
  kiosk: { key: "display.tokenTypeKiosk", fallback: "Kiosk" },
  portal: { key: "display.tokenTypePortal", fallback: "Portal" },
}

function formatWhen(iso: string | null, locale: string, neverLabel: string) {
  if (!iso) return neverLabel
  return new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  })
}

function TokenRow({
  row,
  locale,
  neverLabel,
  revoking,
  onRevoke,
  typeLabel,
  nowMs,
}: {
  row: BranchPublicTokenRow
  locale: string
  neverLabel: string
  revoking: string | null
  onRevoke: (id: string) => void
  typeLabel: string
  nowMs: number
}) {
  const activityAt =
    row.token_type === "display"
      ? row.last_display_ping_at
      : row.token_type === "kiosk"
        ? row.last_kiosk_session_at
        : null

  const isRecentPing =
    row.token_type === "display" &&
    row.last_display_ping_at != null &&
    nowMs - new Date(row.last_display_ping_at).getTime() < 5 * 60 * 1000

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <Badge variant={row.token_type === "display" ? "info" : "outline"} className="text-[10px]">
            {typeLabel}
          </Badge>
          {isRecentPing ? (
            <Badge variant="success" className="text-[10px]">
              Live
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-neutral-500 font-mono">…{row.token_suffix}</p>
        {row.label ? <p className="text-[11px] text-neutral-600">{row.label}</p> : null}
      </td>
      <td className="py-2 pr-3 text-xs text-neutral-600 whitespace-nowrap">
        {formatWhen(row.created_at, locale, neverLabel)}
      </td>
      <td className="py-2 pr-3 text-xs text-neutral-600 whitespace-nowrap">
        {formatWhen(activityAt, locale, neverLabel)}
        {row.token_type === "display" && row.display_ping_count != null ? (
          <span className="block text-[10px] text-neutral-400">{row.display_ping_count} pings</span>
        ) : null}
      </td>
      <td className="py-2 text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          disabled={revoking === row.id}
          onClick={() => onRevoke(row.id)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Close
        </Button>
      </td>
    </tr>
  )
}

export function BranchPublicTokensPanel({
  branchId,
  onChanged,
}: {
  branchId: string
  onChanged?: () => void
}) {
  const { t, locale } = useLocale()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<BranchPublicTokenRow[]>([])
  const [revoking, setRevoking] = useState<string | null>(null)
  const [bulkType, setBulkType] = useState<PublicTokenType | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const neverLabel = t("display.never", "Never")

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listBranchPublicTokens(branchId)
    if (error) toast.error(error)
    setRows(data)
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const counts = useMemo(() => {
    const display = rows.filter((r) => r.token_type === "display").length
    const kiosk = rows.filter((r) => r.token_type === "kiosk").length
    const portal = rows.filter((r) => r.token_type === "portal").length
    return { display, kiosk, portal }
  }, [rows])

  const showWarning = counts.display > 2 || counts.kiosk > 2

  const handleRevokeOne = async (tokenId: string) => {
    setRevoking(tokenId)
    const { error } = await revokeBranchPublicToken(tokenId)
    setRevoking(null)
    if (error) toast.error(error)
    else {
      toast.success(t("display.tokenRevoked", "Link closed"))
      await load()
      onChanged?.()
    }
  }

  const handleKeepLatest = async (tokenType: PublicTokenType) => {
    setBulkType(tokenType)
    const { data, error } = await revokeStaleBranchPublicTokens({
      branchId,
      tokenType,
      keepCount: 1,
      preferRecentPing: tokenType === "display",
    })
    setBulkType(null)
    if (error) toast.error(error)
    else {
      toast.success(
        t("display.tokensClosedBulk", "{n} old link(s) closed — kept the active one.").replace(
          "{n}",
          String(data?.revoked ?? 0)
        )
      )
      await load()
      onChanged?.()
    }
  }

  const handleCloseAll = async (tokenType: PublicTokenType) => {
    setBulkType(tokenType)
    const { data, error } = await revokeStaleBranchPublicTokens({
      branchId,
      tokenType,
      keepCount: 0,
    })
    setBulkType(null)
    if (error) toast.error(error)
    else {
      toast.success(
        t("display.tokensClosedAll", "All {type} links closed ({n}).")
          .replace("{type}", TYPE_LABEL[tokenType].fallback)
          .replace("{n}", String(data?.revoked ?? 0))
      )
      await load()
      onChanged?.()
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-neutral-500" aria-hidden />
            {t("display.tokenControlTitle", "Open device links")}
          </p>
          <p className="mt-1 text-xs text-neutral-500 max-w-xl">
            {t(
              "display.tokenControlHint",
              "Each “Generate link” creates a new URL. Too many open links can confuse the TV display. Close old sessions and keep only the screen you use."
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
          {t("common.refresh", "Refresh")}
        </Button>
      </div>

      {showWarning ? (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            {t(
              "display.tokenWarningMany",
              "You have {tv} TV and {kiosk} kiosk links open. Close old ones so only the waiting-room screen stays active."
            )
              .replace("{tv}", String(counts.display))
              .replace("{kiosk}", String(counts.kiosk))}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {counts.display > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkType !== null}
            onClick={() => void handleKeepLatest("display")}
          >
            {bulkType === "display"
              ? t("common.loading", "Loading…")
              : t("display.keepLatestTv", "Close other TV links")}
          </Button>
        ) : null}
        {counts.kiosk > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkType !== null}
            onClick={() => void handleKeepLatest("kiosk")}
          >
            {bulkType === "kiosk"
              ? t("common.loading", "Loading…")
              : t("display.keepLatestKiosk", "Close other kiosk links")}
          </Button>
        ) : null}
        {counts.portal > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkType !== null}
            onClick={() => void handleKeepLatest("portal")}
          >
            {bulkType === "portal"
              ? t("common.loading", "Loading…")
              : t("display.keepLatestPortal", "Close other portal links")}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">{t("common.loading", "Loading…")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t("display.noOpenLinks", "No active device links. Generate one below.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="pb-2 font-medium">{t("display.tokenColType", "Type")}</th>
                <th className="pb-2 font-medium">{t("display.tokenColCreated", "Created")}</th>
                <th className="pb-2 font-medium">{t("display.tokenColActivity", "Last activity")}</th>
                <th className="pb-2 font-medium text-right">{t("display.tokenColAction", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <TokenRow
                  key={row.id}
                  row={row}
                  locale={locale}
                  neverLabel={neverLabel}
                  revoking={revoking}
                  onRevoke={handleRevokeOne}
                  typeLabel={t(TYPE_LABEL[row.token_type].key, TYPE_LABEL[row.token_type].fallback)}
                  nowMs={nowMs}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 ? (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer hover:text-neutral-700">
            {t("display.closeAllAdvanced", "Advanced: close all links by type")}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["display", "kiosk", "portal"] as const).map((type) =>
              counts[type] > 0 ? (
                <Button
                  key={type}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  disabled={bulkType !== null}
                  onClick={() => void handleCloseAll(type)}
                >
                  {t("display.closeAllType", "Close all {type}").replace(
                    "{type}",
                    t(TYPE_LABEL[type].key, TYPE_LABEL[type].fallback)
                  )}
                </Button>
              ) : null
            )}
          </div>
        </details>
      ) : null}
    </div>
  )
}

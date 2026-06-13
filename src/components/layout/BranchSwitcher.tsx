"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useBranch } from "@/hooks/use-branch"
import { usePermissionStore } from "@/stores/permission-store"
import { fetchMyPermissions, fetchOrganization } from "@/lib/auth/auth-service"
import { Building2, Loader2 } from "lucide-react"

export function BranchSwitcher() {
  const router = useRouter()
  const { activeBranch, availableBranches, setActiveBranch, bumpBranchRevision } = useBranch()
  const { loading: permissionsLoading, setLoading, setPermissions } = usePermissionStore()
  const [isOpen, setIsOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const [orgName, setOrgName] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchOrganization().then((org) => setOrgName(org?.name ?? null))
  }, [activeBranch?.organization_id])

  const handleSelect = async (branch: (typeof availableBranches)[number]) => {
    if (branch.id === activeBranch?.id) {
      setIsOpen(false)
      return
    }

    setSwitching(true)
    setActiveBranch(branch)
    setLoading(true)

    const keys = await fetchMyPermissions(branch.id)
    setPermissions(keys, branch.id)
    bumpBranchRevision()
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("dentali:branch-changed", { detail: { branchId: branch.id } })
      )
    }
    router.refresh()
    setSwitching(false)
    setIsOpen(false)
  }

  const busy = switching || permissionsLoading
  const multiBranch = availableBranches.length > 1

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={availableBranches.length === 0}
        className="flex max-w-[min(100%,14rem)] sm:max-w-xs items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-500" />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-primary-500" />
        )}
        <span className="flex flex-col items-start min-w-0 text-left leading-tight">
          {orgName ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 truncate max-w-full">
              {orgName}
            </span>
          ) : null}
          <span className="truncate max-w-full">
            {activeBranch ? activeBranch.name : "No branch assigned"}
          </span>
        </span>
      </button>

      {isOpen && availableBranches.length > 0 && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close branch menu"
            onClick={() => setIsOpen(false)}
          />
          <div
            role="listbox"
            className="absolute top-full left-0 mt-1 w-60 rounded-md border border-neutral-200 bg-white shadow-lg z-50 py-1"
          >
            {orgName ? (
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                {multiBranch ? "Switch branch" : "Your clinic"}
              </p>
            ) : null}
            {availableBranches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                role="option"
                aria-selected={branch.id === activeBranch?.id}
                onClick={() => handleSelect(branch)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-100 ${
                  branch.id === activeBranch?.id
                    ? "bg-primary-50 text-primary-800 font-medium"
                    : "text-neutral-700"
                }`}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

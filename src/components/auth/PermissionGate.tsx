"use client"

import { usePermission } from "@/hooks/use-permission"
import { PermissionDenied } from "./PermissionDenied"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

interface PermissionGateProps {
  permission?: string
  /** Grant access when the user has any listed permission. */
  anyOf?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ permission, anyOf, children, fallback }: PermissionGateProps) {
  const { hasPermission, loading } = usePermission()

  if (loading) {
    return <PageLoadingSkeleton variant="compact" />
  }

  const allowed = anyOf?.length
    ? anyOf.some((key) => hasPermission(key))
    : permission
      ? hasPermission(permission)
      : true

  if (!allowed) {
    const deniedKey = permission ?? anyOf?.[0] ?? "access"
    return fallback ?? <PermissionDenied permission={deniedKey} />
  }

  return <>{children}</>
}

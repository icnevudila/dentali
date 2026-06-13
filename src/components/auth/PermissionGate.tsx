"use client"

import { usePermission } from "@/hooks/use-permission"
import { PermissionDenied } from "./PermissionDenied"
import { PageLoadingSkeleton } from "@/components/layout/PageLoadingSkeleton"

interface PermissionGateProps {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const { hasPermission, loading } = usePermission()

  if (loading) {
    return <PageLoadingSkeleton variant="compact" />
  }

  if (!hasPermission(permission)) {
    return fallback ?? <PermissionDenied permission={permission} />
  }

  return <>{children}</>
}

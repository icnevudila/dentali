"use client"

import { useParams } from "next/navigation"
import { useShowcaseRouteParams } from "@/components/showcase/ShowcaseBootstrap"
import { getShowcaseSnapshot } from "@/lib/showcase/intercept"

/** Next.js 16 client pages must use useParams(), not props.params */
export function useRouteParams<T extends Record<string, string> = Record<string, string>>() {
  const showcaseParams = useShowcaseRouteParams<T>()
  const params = useParams() as T
  const hasShowcaseParams = Object.keys(showcaseParams).length > 0
  if (hasShowcaseParams) return showcaseParams
  const chartId = getShowcaseSnapshot()?.chartPatientId
  if (chartId && !(params as Record<string, string | undefined>).id) {
    return { ...(params as Record<string, string>), id: chartId } as unknown as T
  }
  return params
}

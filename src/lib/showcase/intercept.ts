import type { ShowcaseSnapshot } from "@/lib/showcase/types"

let activeSnapshot: ShowcaseSnapshot | null = null

export function setShowcaseSnapshot(snapshot: ShowcaseSnapshot | null) {
  activeSnapshot = snapshot
}

export function getShowcaseSnapshot(): ShowcaseSnapshot | null {
  return activeSnapshot
}

export function isShowcaseActive(): boolean {
  return activeSnapshot !== null
}

export function getShowcaseBranchId(): string | null {
  return activeSnapshot?.branch.id ?? null
}

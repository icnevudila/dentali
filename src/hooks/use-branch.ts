"use client"

import { useBranchStore } from '@/stores/branch-store'

export function useBranch() {
  const {
    activeBranch,
    availableBranches,
    branchRevision,
    setActiveBranch,
    setAvailableBranches,
    bumpBranchRevision,
  } = useBranchStore()

  return {
    activeBranch,
    availableBranches,
    branchRevision,
    setActiveBranch,
    setAvailableBranches,
    bumpBranchRevision,
    hasActiveBranch: activeBranch !== null,
  }
}

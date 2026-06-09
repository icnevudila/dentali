"use client"

import { useBranchStore } from '@/stores/branch-store'

export function useBranch() {
  const { activeBranch, availableBranches, setActiveBranch, setAvailableBranches } = useBranchStore()

  return {
    activeBranch,
    availableBranches,
    setActiveBranch,
    setAvailableBranches,
    // Helper to check if a branch is selected
    hasActiveBranch: activeBranch !== null
  }
}

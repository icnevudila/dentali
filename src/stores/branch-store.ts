import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safe-storage'

interface Branch {
  id: string
  name: string
  organization_id: string
}

interface BranchState {
  activeBranch: Branch | null
  availableBranches: Branch[]
  /** Bumps when user switches branch — client pages refetch scoped data */
  branchRevision: number
  setActiveBranch: (branch: Branch) => void
  setAvailableBranches: (branches: Branch[]) => void
  bumpBranchRevision: () => void
  clearBranchData: () => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranch: null,
      availableBranches: [],
      branchRevision: 0,
      setActiveBranch: (branch) => set({ activeBranch: branch }),
      setAvailableBranches: (branches) => set({ availableBranches: branches }),
      bumpBranchRevision: () => set((s) => ({ branchRevision: s.branchRevision + 1 })),
      clearBranchData: () => set({ activeBranch: null, availableBranches: [], branchRevision: 0 }),
    }),
    {
      name: 'dentali-branch-storage',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        activeBranch: state.activeBranch,
        availableBranches: state.availableBranches,
      }),
    }
  )
)

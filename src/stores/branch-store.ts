import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Branch {
  id: string
  name: string
  organization_id: string
}

interface BranchState {
  activeBranch: Branch | null
  availableBranches: Branch[]
  setActiveBranch: (branch: Branch) => void
  setAvailableBranches: (branches: Branch[]) => void
  clearBranchData: () => void
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranch: null,
      availableBranches: [],
      setActiveBranch: (branch) => set({ activeBranch: branch }),
      setAvailableBranches: (branches) => set({ availableBranches: branches }),
      clearBranchData: () => set({ activeBranch: null, availableBranches: [] }),
    }),
    {
      name: 'dentali-branch-storage',
    }
  )
)

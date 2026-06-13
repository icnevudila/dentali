import { create } from "zustand"

interface PermissionState {
  permissions: Set<string>
  loading: boolean
  branchId: string | null
  setPermissions: (keys: string[], branchId: string | null) => void
  setLoading: (loading: boolean) => void
  clearPermissions: () => void
  hasPermission: (key: string) => boolean
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: new Set(),
  loading: true,
  branchId: null,
  setPermissions: (keys, branchId) =>
    set({ permissions: new Set(keys), branchId, loading: false }),
  setLoading: (loading) => set({ loading }),
  clearPermissions: () =>
    set({ permissions: new Set(), branchId: null, loading: false }),
  hasPermission: (key) => {
    const { permissions, loading } = get()
    if (loading) return false
    return permissions.has(key)
  },
}))

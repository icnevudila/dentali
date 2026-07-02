import { StateStorage } from 'zustand/middleware'

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(name)
      }
    } catch {}
    return null
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(name, value)
      }
    } catch {}
  },
  removeItem: (name) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(name)
      }
    } catch {}
  },
}

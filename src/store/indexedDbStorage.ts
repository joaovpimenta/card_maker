import { get, set, del } from "idb-keyval"
import type { StateStorage } from "zustand/middleware"

let persistenceEnabled = false
export function setPersistenceEnabled(enabled: boolean) {
  persistenceEnabled = enabled
}

function reportStorageError(error: unknown) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("card-maker-storage-error", {
      detail: error instanceof Error ? error.message : String(error),
    }))
  }
}

export const indexedDbStorage: StateStorage = {
  getItem: async name => {
    try {
      const value = await get(name)
      return value ? JSON.stringify(value) : null
    } catch (error) {
      reportStorageError(error)
      throw error
    }
  },
  setItem: async (name, value) => {
    if (!persistenceEnabled) return
    try {
      await set(name, JSON.parse(value))
    } catch (error) {
      persistenceEnabled = false
      reportStorageError(error)
    }
  },
  removeItem: async (name) => {
    try {
      await del(name)
    } catch (error) {
      persistenceEnabled = false
      reportStorageError(error)
    }
  },
}


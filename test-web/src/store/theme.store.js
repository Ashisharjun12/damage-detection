import { useSyncExternalStore } from "react"

const STORAGE_KEY = "vite-ui-theme"

function readStoredTheme() {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") return stored
  return "system"
}

function getSystemTheme() {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applyThemeClass(theme) {
  if (typeof document === "undefined") return

  const root = document.documentElement
  root.classList.remove("light", "dark")

  const resolved = theme === "system" ? getSystemTheme() : theme
  root.classList.add(resolved)
}

const listeners = new Set()

const state = {
  theme: readStoredTheme(),
  setTheme(theme) {
    state.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
    applyThemeClass(theme)
    listeners.forEach((listener) => listener())
  },
}

export function useThemeStore(selector) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => selector(state),
    () => selector({ theme: "system", setTheme: () => {} }),
  )
}

// Apply stored theme on first load in the browser
if (typeof window !== "undefined") {
  applyThemeClass(state.theme)
}

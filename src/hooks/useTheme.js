// src/hooks/useTheme.js
// Manages light/dark mode. Stores preference in localStorage.
// Applies data-theme="light" on <html> for light mode; dark is default.

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'jarvis-theme'

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    // Read persisted preference; default to dark
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', 'light')
    }
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = () => setIsDark(prev => !prev)

  return { isDark, toggle }
}

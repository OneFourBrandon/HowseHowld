import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  return <button type="button" aria-label={dark ? 'Use light mode' : 'Use dark mode'} aria-pressed={dark}
    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-(--line) bg-(--surface-strong) text-(--ink) transition-colors hover:bg-(--sage-2)"
    onClick={() => {
      const next = !dark
      setDark(next)
      document.documentElement.dataset.theme = next ? 'dark' : 'light'
      try { localStorage.setItem('howsehowld:theme', next ? 'dark' : 'light') } catch { /* Storage may be disabled; theme still works for this visit. */ }
    }}>
    {dark ? <Sun size={19} /> : <Moon size={19} />}
  </button>
}

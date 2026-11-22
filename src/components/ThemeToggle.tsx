import { Moon, Sun } from 'lucide-react'
import { setTheme, useAppearance } from '../lib/appearance'

export function ThemeToggle() {
  const dark = useAppearance().theme === 'dark'
  return <button type="button" aria-label={dark ? 'Use light mode' : 'Use dark mode'} aria-pressed={dark}
    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-(--line) bg-(--surface-strong) text-(--ink) transition-colors hover:bg-(--sage-2)"
    onClick={() => setTheme(dark ? 'light' : 'dark')}>
    {dark ? <Sun size={19} /> : <Moon size={19} />}
  </button>
}

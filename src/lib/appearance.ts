import { useSyncExternalStore } from 'react'

/**
 * Appearance is a per-device preference, like the theme always was.
 * `classic` is the original layout and stays the default. `slate` is the newer
 * layout, switched on from Settings.
 */
export type Design = 'classic' | 'slate'
export type Theme = 'light' | 'dark'

export interface Appearance {
  design: Design
  theme: Theme
}

export const DESIGN_KEY = 'howsehowld:design'
/** The classic theme keeps its original key so existing devices keep their choice. */
export const CLASSIC_THEME_KEY = 'howsehowld:theme'
/** Slate remembers its own theme. It was drawn dark first, so dark is its default. */
export const SLATE_THEME_KEY = 'howsehowld:slate-theme'

const CLASSIC_CHROME = '#203f36'
const SLATE_CHROME: Record<Theme, string> = { dark: '#101113', light: '#f1f2f3' }

function stored(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage may be disabled. The choice still applies for this visit.
  }
}

function prefersDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function storedDesign(): Design {
  return stored(DESIGN_KEY) === 'slate' ? 'slate' : 'classic'
}

export function storedTheme(design: Design): Theme {
  const value = stored(design === 'slate' ? SLATE_THEME_KEY : CLASSIC_THEME_KEY)
  if (value === 'light' || value === 'dark') return value
  if (design === 'slate') return 'dark'
  return prefersDark() ? 'dark' : 'light'
}

/** index.html applies the stored choice before first paint, so the document is the source of truth. */
function fromDocument(): Appearance {
  const { design, theme } = document.documentElement.dataset
  const resolvedDesign: Design = design === 'slate' ? 'slate' : 'classic'
  return {
    design: resolvedDesign,
    theme: theme === 'light' || theme === 'dark' ? theme : storedTheme(resolvedDesign),
  }
}

let current: Appearance | null = null
const listeners = new Set<() => void>()

function apply(next: Appearance) {
  const root = document.documentElement
  root.dataset.design = next.design
  root.dataset.theme = next.theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next.design === 'slate' ? SLATE_CHROME[next.theme] : CLASSIC_CHROME)
  current = next
  for (const listener of listeners) listener()
}

export function getAppearance(): Appearance {
  current ??= fromDocument()
  return current
}

export function setDesign(design: Design) {
  store(DESIGN_KEY, design)
  apply({ design, theme: storedTheme(design) })
}

export function setTheme(theme: Theme) {
  const { design } = getAppearance()
  store(design === 'slate' ? SLATE_THEME_KEY : CLASSIC_THEME_KEY, theme)
  apply({ design, theme })
}

/**
 * Called once as the app starts. index.html has already set the design and
 * theme; this brings the browser chrome colour in line with them.
 */
export function syncAppearance() {
  apply(fromDocument())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance)
}

/** Test seam: forget the cached choice so the next read comes from the document. */
export function resetAppearanceCache() {
  current = null
}

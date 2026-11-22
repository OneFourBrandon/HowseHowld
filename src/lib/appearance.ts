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

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

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

/** The theme a design opens with on a fresh page load. */
export function storedTheme(design: Design): Theme {
  const value = stored(design === 'slate' ? SLATE_THEME_KEY : CLASSIC_THEME_KEY)
  if (isTheme(value)) return value
  if (design === 'slate') return 'dark'
  // index.html writes any stored classic value to the document as it is, and only "dark" turns dark on.
  if (value) return 'light'
  return prefersDark() ? 'dark' : 'light'
}

/**
 * index.html applies the stored choice before first paint, so the document is
 * the source of truth and this never second-guesses it. A document without a
 * usable theme is showing light in classic, whose dark styles need
 * data-theme="dark", and dark in slate.
 */
function fromDocument(): Appearance {
  const { design, theme } = document.documentElement.dataset
  const resolved: Design = design === 'slate' ? 'slate' : 'classic'
  return { design: resolved, theme: isTheme(theme) ? theme : resolved === 'slate' ? 'dark' : 'light' }
}

let current: Appearance | null = null
/** The theme each design last showed in this visit, so switching back restores it even without storage. */
let shown: Partial<Record<Design, Theme>> = {}
const listeners = new Set<() => void>()

function apply(next: Appearance) {
  const root = document.documentElement
  root.dataset.design = next.design
  root.dataset.theme = next.theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next.design === 'slate' ? SLATE_CHROME[next.theme] : CLASSIC_CHROME)
  current = next
  shown[next.design] = next.theme
  for (const listener of listeners) listener()
}

export function getAppearance(): Appearance {
  if (!current) {
    current = fromDocument()
    shown[current.design] = current.theme
  }
  return current
}

export function setDesign(design: Design) {
  getAppearance()
  store(DESIGN_KEY, design)
  apply({ design, theme: shown[design] ?? storedTheme(design) })
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

/** Show classic for the rest of this visit without changing what is stored. */
export function fallBackToClassic() {
  apply({ design: 'classic', theme: storedTheme('classic') })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getDesign = () => getAppearance().design

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, getAppearance, getAppearance)
}

/** The design alone, for components that should not re-render when only the theme changes. */
export function useDesign(): Design {
  return useSyncExternalStore(subscribe, getDesign, getDesign)
}

/** Test seam: forget the cached choice so the next read comes from the document. */
export function resetAppearanceCache() {
  current = null
  shown = {}
}

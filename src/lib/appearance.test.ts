import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLASSIC_THEME_KEY,
  DESIGN_KEY,
  SLATE_THEME_KEY,
  fallBackToClassic,
  getAppearance,
  resetAppearanceCache,
  setDesign,
  setTheme,
  storedDesign,
  storedTheme,
  syncAppearance,
} from './appearance'

const root = document.documentElement
const systemPrefersDark = (dark: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark }))

describe('appearance', () => {
  beforeEach(() => {
    localStorage.clear()
    delete root.dataset.design
    delete root.dataset.theme
    document.head.innerHTML = '<meta name="theme-color" content="#203f36">'
    resetAppearanceCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps the classic design until the new one is switched on', () => {
    expect(storedDesign()).toBe('classic')
    expect(getAppearance().design).toBe('classic')
  })

  it('switches the design on the document and remembers it', () => {
    setDesign('slate')
    expect(root.dataset.design).toBe('slate')
    expect(localStorage.getItem(DESIGN_KEY)).toBe('slate')
    expect(getAppearance().design).toBe('slate')

    setDesign('classic')
    expect(root.dataset.design).toBe('classic')
    expect(localStorage.getItem(DESIGN_KEY)).toBe('classic')
  })

  it('opens the new design dark, whatever the classic theme was', () => {
    localStorage.setItem(CLASSIC_THEME_KEY, 'light')
    root.dataset.theme = 'light'
    setDesign('slate')
    expect(root.dataset.theme).toBe('dark')
    // Turning it on does not rewrite the classic choice.
    expect(localStorage.getItem(CLASSIC_THEME_KEY)).toBe('light')
  })

  it('remembers a theme for each design separately', () => {
    localStorage.setItem(CLASSIC_THEME_KEY, 'light')
    root.dataset.theme = 'light'
    setDesign('slate')
    setTheme('light')
    expect(localStorage.getItem(SLATE_THEME_KEY)).toBe('light')

    setDesign('classic')
    setTheme('dark')
    expect(localStorage.getItem(CLASSIC_THEME_KEY)).toBe('dark')
    expect(localStorage.getItem(SLATE_THEME_KEY)).toBe('light')

    setDesign('slate')
    expect(root.dataset.theme).toBe('light')
  })

  it('opens classic on the system colour scheme when nothing is stored', () => {
    systemPrefersDark(true)
    expect(storedTheme('classic')).toBe('dark')
    expect(storedTheme('slate')).toBe('dark')
    systemPrefersDark(false)
    expect(storedTheme('classic')).toBe('light')
    expect(storedTheme('slate')).toBe('dark')
  })

  it('reads the choice index.html applied before first paint', () => {
    root.dataset.design = 'slate'
    root.dataset.theme = 'light'
    expect(getAppearance()).toEqual({ design: 'slate', theme: 'light' })
  })

  it('never second-guesses what the document is showing', () => {
    // index.html sets nothing when storage is blocked, and classic then shows light.
    // A dark system setting must not flip it once the app starts.
    systemPrefersDark(true)
    expect(getAppearance()).toEqual({ design: 'classic', theme: 'light' })
    syncAppearance()
    expect(root.dataset.theme).toBe('light')
    expect(root.dataset.design).toBe('classic')
  })

  it('treats an unusable theme on the document as the one being shown', () => {
    root.dataset.theme = 'Dark'
    expect(getAppearance().theme).toBe('light')

    resetAppearanceCache()
    root.dataset.design = 'slate'
    root.dataset.theme = 'sepia'
    expect(getAppearance()).toEqual({ design: 'slate', theme: 'dark' })
  })

  it('switches back to the theme a design was showing, even with storage blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    systemPrefersDark(true)

    expect(getAppearance()).toEqual({ design: 'classic', theme: 'light' })
    setDesign('slate')
    expect(getAppearance()).toEqual({ design: 'slate', theme: 'dark' })
    setDesign('classic')
    expect(getAppearance()).toEqual({ design: 'classic', theme: 'light' })
  })

  it('can show classic for one visit without forgetting the stored choice', () => {
    setDesign('slate')
    fallBackToClassic()
    expect(root.dataset.design).toBe('classic')
    expect(localStorage.getItem(DESIGN_KEY)).toBe('slate')
  })

  it('matches the browser chrome to the design', () => {
    const chrome = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    setDesign('slate')
    expect(chrome()).toBe('#101113')
    setTheme('light')
    expect(chrome()).toBe('#f1f2f3')
    setDesign('classic')
    expect(chrome()).toBe('#203f36')
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem(DESIGN_KEY, 'neon')
    localStorage.setItem(SLATE_THEME_KEY, 'sepia')
    expect(storedDesign()).toBe('classic')
    expect(storedTheme('slate')).toBe('dark')
  })

  it('reads an unexpected classic theme the way a page load shows it', () => {
    // index.html writes the stored value to the document as it is, and only "dark" turns dark on.
    localStorage.setItem(CLASSIC_THEME_KEY, 'blue')
    systemPrefersDark(true)
    expect(storedTheme('classic')).toBe('light')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLASSIC_THEME_KEY,
  DESIGN_KEY,
  SLATE_THEME_KEY,
  getAppearance,
  resetAppearanceCache,
  setDesign,
  setTheme,
  storedDesign,
  storedTheme,
} from './appearance'

const root = document.documentElement

describe('appearance', () => {
  beforeEach(() => {
    localStorage.clear()
    delete root.dataset.design
    delete root.dataset.theme
    document.head.innerHTML = '<meta name="theme-color" content="#203f36">'
    resetAppearanceCache()
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
    setDesign('slate')
    expect(root.dataset.theme).toBe('dark')
    // Turning it on does not rewrite the classic choice.
    expect(localStorage.getItem(CLASSIC_THEME_KEY)).toBe('light')
  })

  it('remembers a theme for each design separately', () => {
    localStorage.setItem(CLASSIC_THEME_KEY, 'light')
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

  it('follows the system colour scheme for classic when nothing is stored', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    expect(storedTheme('classic')).toBe('dark')
    expect(storedTheme('slate')).toBe('dark')
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    expect(storedTheme('classic')).toBe('light')
    expect(storedTheme('slate')).toBe('dark')
  })

  it('reads the choice index.html applied before first paint', () => {
    root.dataset.design = 'slate'
    root.dataset.theme = 'light'
    expect(getAppearance()).toEqual({ design: 'slate', theme: 'light' })
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
})

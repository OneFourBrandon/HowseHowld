import { type ComponentType, createElement, lazy, type ReactElement } from 'react'
import { type Design, setDesign } from './appearance'

/**
 * A lazily loaded component that can also be loaded ahead of time. Once it has
 * been, it renders straight away instead of suspending. A plain `lazy()`
 * suspends on its first render even when its module is already in memory, which
 * would flash the loading screen every time the design is switched.
 */
export interface Preloadable<Props> {
  (props: Props): ReactElement
  preload: () => Promise<void>
}

export function preloadable<Props extends object>(load: () => Promise<ComponentType<Props>>): Preloadable<Props> {
  let loaded: ComponentType<Props> | undefined
  let pending: Promise<ComponentType<Props>> | undefined
  const loadOnce = () => {
    pending ??= load().then(
      (component) => {
        loaded = component
        return component
      },
      (error: unknown) => {
        // Let a later attempt try again.
        pending = undefined
        throw error
      },
    )
    return pending
  }
  const Lazy = lazy(() => loadOnce().then((component) => ({ default: component })))
  const Component = (props: Props) => createElement((loaded ?? Lazy) as ComponentType<Props>, props)
  Component.preload = () => loadOnce().then(() => undefined)
  return Component
}

// The parts of each design that the other one does not already have in memory.
export const SlateShell = preloadable(() => import('../slate/SlateShell').then((module) => module.SlateShell))
export const SlateOverviewPage = preloadable(() => import('../slate/OverviewPage').then((module) => module.OverviewPage))
export const SlateSettingsPage = preloadable(() => import('../slate/SettingsPage').then((module) => module.SettingsPage))
export const ClassicSettingsPage = preloadable(() => import('../pages/SettingsPage').then((module) => module.SettingsPage))

/**
 * Fetch the slate stylesheet and confirm it arrived. slate.css sets
 * `--sl-loaded` on the root element. The bundler remembers every stylesheet it
 * has tried, so after one failure the import resolves at once with nothing
 * loaded; without this check slate would then render unstyled.
 *
 * This is the only place the stylesheet is imported from. The same memory
 * means a second importer could see the import resolve while the first one's
 * request was still in flight, and fail this check for a stylesheet that was
 * about to arrive.
 */
export async function loadSlateStyles() {
  await import('../slate/styles')
  const marker = getComputedStyle(document.documentElement).getPropertyValue('--sl-loaded').trim()
  if (marker !== '1') throw new Error('The slate stylesheet did not load.')
}

/** Everything slate needs before it can paint. None of it is loaded by a page that stays on classic. */
export function loadSlate() {
  return Promise.all([loadSlateStyles(), SlateShell.preload(), SlateSettingsPage.preload()])
}

/**
 * Switch design from Settings. The other design's code is fetched first, so
 * the switch lands on a finished page instead of a loading screen. Rejects,
 * without switching, if that code cannot be fetched.
 */
export async function switchDesign(design: Design) {
  await (design === 'slate' ? loadSlate() : ClassicSettingsPage.preload())
  setDesign(design)
}

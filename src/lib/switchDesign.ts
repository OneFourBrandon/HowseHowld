import { type Design, setDesign } from './appearance'

/**
 * Everything the slate design needs before it can paint. None of it is loaded
 * for people who stay on classic.
 */
export function loadSlate() {
  return Promise.all([
    import('../slate/styles'),
    import('../slate/SlateShell'),
    import('../slate/SettingsPage'),
  ])
}

/**
 * Switch design from Settings. The other design's code is fetched first, so
 * the switch lands on a finished page instead of a loading screen. Rejects,
 * without switching, if that code cannot be fetched.
 */
export async function switchDesign(design: Design) {
  await (design === 'slate' ? loadSlate() : import('../pages/SettingsPage'))
  setDesign(design)
}

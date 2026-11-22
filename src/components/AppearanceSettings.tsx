import { setDesign, useAppearance } from '../lib/appearance'
import { Card, SectionHeader, Toggle } from './ui'

/** The switch for the optional new design, as it appears in the classic Settings page. */
export function AppearanceSettings() {
  const { design } = useAppearance()
  return (
    <section>
      <SectionHeader eyebrow="THIS DEVICE" title="Appearance" />
      <Card className="settings-card border-b border-b-(--line) px-1 pb-5">
        <Toggle
          checked={design === 'slate'}
          onChange={(on) => setDesign(on ? 'slate' : 'classic')}
          label="New design"
        />
        <p className="settings-note mt-1 max-w-155 text-[.75rem] leading-[1.5] text-(--muted)">
          A darker, denser layout with charts on every page. It changes this device only, and you can
          switch back here at any time.
        </p>
      </Card>
    </section>
  )
}

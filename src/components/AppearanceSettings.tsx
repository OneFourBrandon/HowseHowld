import { useState } from 'react'
import { useDesign } from '../lib/appearance'
import { switchDesign } from '../lib/switchDesign'
import { Card, SectionHeader, Toggle } from './ui'

/** The switch for the optional new design, as it appears in the classic Settings page. */
export function AppearanceSettings() {
  const design = useDesign()
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')

  return (
    <section>
      <SectionHeader eyebrow="THIS DEVICE" title="Appearance" />
      <Card className="settings-card border-b border-b-(--line) px-1 pb-5">
        <Toggle
          checked={design === 'slate'}
          onChange={(on) => {
            if (state === 'loading') return
            setState('loading')
            // The new design's code is fetched first, so the switch lands on a finished page.
            switchDesign(on ? 'slate' : 'classic').then(() => setState('idle'), () => setState('failed'))
          }}
          label="New design"
        />
        <p className="settings-note mt-1 max-w-155 text-[.75rem] leading-[1.5] text-(--muted)">
          A darker, denser layout with charts on every page. It changes this device only, and you can
          switch back here at any time.
        </p>
        {state === 'failed' && (
          <p className="mt-2 text-[.75rem] text-(--coral)" role="alert">
            The new design could not be loaded. Check your connection and try again.
          </p>
        )}
      </Card>
    </section>
  )
}

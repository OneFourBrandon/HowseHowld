import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppDataProvider } from '../state/AppDataContext'
import { demoSnapshot } from '../data/demo'
import { TodayPage } from './TodayPage'

describe('Today page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('puts an actionable notification warning before the overview header', () => {
    render(
      <MemoryRouter>
        <AppDataProvider>
          <TodayPage />
        </AppDataProvider>
      </MemoryRouter>,
    )

    const warning = screen.getByRole('link', { name: /don’t miss the last call/i })
    const heading = screen.getByRole('heading', { name: /good (morning|afternoon|evening)/i })
    expect(
      warning.compareDocumentPosition(heading)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows exactly three dates at mobile widths', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(
      <MemoryRouter>
        <AppDataProvider>
          <TodayPage />
        </AppDataProvider>
      </MemoryRouter>,
    )

    expect(within(screen.getByRole('group', { name: 'Visible dates' })).getAllByRole('button')).toHaveLength(3)
  })

  it('hides the notification warning when this device is subscribed', () => {
    const original = demoSnapshot.notificationHealth.subscribed
    demoSnapshot.notificationHealth.subscribed = true
    try {
      render(
        <MemoryRouter>
          <AppDataProvider>
            <TodayPage />
          </AppDataProvider>
        </MemoryRouter>,
      )
      expect(
        screen.queryByRole('link', { name: /don’t miss the last call/i }),
      ).not.toBeInTheDocument()
    } finally {
      demoSnapshot.notificationHealth.subscribed = original
    }
  })

  it('server-confirms the current member chore in demo mode', async () => {
    render(
      <MemoryRouter>
        <AppDataProvider>
          <TodayPage />
        </AppDataProvider>
      </MemoryRouter>,
    )

    const heading = screen.getByRole('heading', { name: 'Stove & counters' })
    const row = heading.closest('[data-agenda-item]') as HTMLElement | null
    expect(row).not.toBeNull()
    fireEvent.click(within(row!).getByRole('button', { name: /mark complete/i }))
    expect(await within(row!).findByText('Done')).toBeInTheDocument()
    expect(within(row!).queryByRole('button', { name: /mark complete/i })).not.toBeInTheDocument()
  })
})

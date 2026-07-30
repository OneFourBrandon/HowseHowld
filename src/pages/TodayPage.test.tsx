import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppDataProvider } from '../state/AppDataContext'
import { demoSnapshot } from '../data/demo'
import { TodayPage } from './TodayPage'

describe('Today page', () => {
  it('puts an actionable notification warning before the overview header', () => {
    render(
      <MemoryRouter>
        <AppDataProvider>
          <TodayPage />
        </AppDataProvider>
      </MemoryRouter>,
    )

    const warning = screen.getByRole('link', { name: /don’t miss the last call/i })
    const heading = screen.getByRole('heading', { name: /good evening/i })
    expect(
      warning.compareDocumentPosition(heading)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
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

    expect(screen.getByRole('heading', { name: 'Stove & counters' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mark complete/i }))
    expect(await screen.findByText('You’re all clear.')).toBeInTheDocument()
  })
})

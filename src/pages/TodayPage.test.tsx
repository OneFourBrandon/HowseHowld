import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppDataProvider } from '../state/AppDataContext'
import { TodayPage } from './TodayPage'

describe('Today page', () => {
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

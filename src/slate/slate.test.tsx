import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppearanceSettings } from '../components/AppearanceSettings'
import { getAppearance, resetAppearanceCache } from '../lib/appearance'
import { ChoresPage } from '../pages/ChoresPage'
import { MoneyPage } from '../pages/MoneyPage'
import { AppDataProvider } from '../state/AppDataContext'
import { OverviewPage } from './OverviewPage'
import { SlateShell } from './SlateShell'

function renderInHouse(path: string, page: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppDataProvider>
        <Routes>
          <Route element={<SlateShell />}>
            <Route path="*" element={page} />
          </Route>
        </Routes>
      </AppDataProvider>
    </MemoryRouter>,
  )
}

describe('the design switch', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.design
    delete document.documentElement.dataset.theme
    resetAppearanceCache()
  })

  it('is off until someone turns it on, then applies and can be turned back off', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    const toggle = screen.getByRole('switch', { name: 'New design' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(getAppearance()).toEqual({ design: 'slate', theme: 'dark' })
    expect(document.documentElement.dataset.design).toBe('slate')

    await user.click(toggle)
    expect(document.documentElement.dataset.design).toBe('classic')
  })
})

describe('the slate design', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.design = 'slate'
    document.documentElement.dataset.theme = 'dark'
    resetAppearanceCache()
  })

  it('opens the overview on what is waiting on the member and lets them finish a chore there', async () => {
    const user = userEvent.setup()
    renderInHouse('/', <OverviewPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    const needsYou = screen.getByRole('region', { name: 'Needs you' })
    expect(within(needsYou).getByText('Stove & counters')).toBeInTheDocument()
    expect(within(needsYou).getByText(/Confirm \$12\.00 from Noah/)).toBeInTheDocument()

    await user.click(within(needsYou).getByRole('button', { name: 'Mark done' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Task checked off')
    expect(within(needsYou).queryByText('Stove & counters')).not.toBeInTheDocument()
  })

  it('counts what is waiting on the member in the navigation', () => {
    renderInHouse('/', <OverviewPage />)
    const rail = screen.getAllByRole('navigation', { name: 'Primary' })[0]
    // Three votes and one chore under Chores, one payment to confirm under Money.
    expect(within(rail).getByRole('link', { name: /Chores/ })).toHaveTextContent('4')
    expect(within(rail).getByRole('link', { name: /Money/ })).toHaveTextContent('1')
  })

  it('keeps the chore dialogs working behind the new chores layout', async () => {
    const user = userEvent.setup()
    renderInHouse('/chores', <ChoresPage />)

    expect(screen.getByRole('region', { name: 'Coming up' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Who did what' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New chore' }))
    expect(screen.getByRole('dialog', { name: 'Create a chore' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Repeats' })).toBeInTheDocument()
  })

  it('shows money with the shared purchase and bill dialogs still attached', async () => {
    const user = userEvent.setup()
    renderInHouse('/money', <MoneyPage />)

    expect(screen.getByRole('region', { name: 'Your balance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View balance for Maya' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add purchase' }))
    expect(screen.getByRole('dialog', { name: 'Add a shared purchase' })).toBeInTheDocument()
  })

  it('asks for a reason in a dialog before deleting a charge', async () => {
    const user = userEvent.setup()
    renderInHouse('/money', <MoneyPage />)

    await user.click(screen.getByRole('button', { name: 'Delete charge Kitchen spices' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Kitchen spices?' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete charge' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: 'Why are you deleting it?' }), 'Entered twice')
    await user.click(confirm)
    expect(await screen.findByText(/Kitchen spices \(deleted\)/)).toBeInTheDocument()
  })
})

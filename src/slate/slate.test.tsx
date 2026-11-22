import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppearanceSettings } from '../components/AppearanceSettings'
import { getAppearance, resetAppearanceCache, useDesign } from '../lib/appearance'
import { SlateSettingsPage } from '../lib/switchDesign'
import { ChoresPage } from '../pages/ChoresPage'
import { MoneyPage } from '../pages/MoneyPage'
import { AppDataProvider } from '../state/AppDataContext'
import { OverviewPage } from './OverviewPage'
import { SlateShell } from './SlateShell'

// Both settings pages register the service worker through a module that only
// exists in a real build. The design switch preloads them, so stand them in.
vi.mock('./SettingsPage', async () => {
  const { createElement } = await import('react')
  return { SettingsPage: () => createElement('p', null, 'Slate settings page') }
})
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => null }))

/**
 * slate.css marks the root element with `--sl-loaded` so the app can tell the
 * stylesheet arrived. To act out a stylesheet that failed to load, override
 * the mark inline with a value the check rejects.
 */
const stylesheetArrived = (arrived: boolean) => {
  if (arrived) document.documentElement.style.removeProperty('--sl-loaded')
  else document.documentElement.style.setProperty('--sl-loaded', '0')
}

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
    stylesheetArrived(true)
    resetAppearanceCache()
  })

  it('is off until someone turns it on, then applies and can be turned back off', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    const toggle = screen.getByRole('switch', { name: 'New design' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(getAppearance()).toEqual({ design: 'slate', theme: 'dark' })
    expect(document.documentElement.dataset.design).toBe('slate')

    await user.click(toggle)
    await waitFor(() => expect(document.documentElement.dataset.design).toBe('classic'))
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('lands on the new design without ever showing a loading screen', async () => {
    const user = userEvent.setup()
    const fallbackShown = vi.fn()
    function Fallback() {
      fallbackShown()
      return <p>Loading</p>
    }
    // The same shape as App: one Suspense boundary around whichever design is on.
    function Switcher() {
      const slate = useDesign() === 'slate'
      return <Suspense fallback={<Fallback />}>{slate ? <SlateSettingsPage /> : <AppearanceSettings />}</Suspense>
    }
    render(<Switcher />)

    await user.click(screen.getByRole('switch', { name: 'New design' }))
    expect(await screen.findByText('Slate settings page')).toBeInTheDocument()
    expect(fallbackShown).not.toHaveBeenCalled()
  })

  it('stays on classic and says so when the new design’s stylesheet did not arrive', async () => {
    stylesheetArrived(false)
    const user = userEvent.setup()
    render(<AppearanceSettings />)

    await user.click(screen.getByRole('switch', { name: 'New design' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    expect(document.documentElement.dataset.design).not.toBe('slate')
    expect(screen.getByRole('switch', { name: 'New design' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('the slate design', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.design = 'slate'
    document.documentElement.dataset.theme = 'dark'
    stylesheetArrived(true)
    resetAppearanceCache()
  })

  it('opens the overview on what is waiting on the member and lets them finish a chore there', async () => {
    const user = userEvent.setup()
    renderInHouse('/', <OverviewPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    const needsYou = screen.getByRole('region', { name: 'Needs you' })
    expect(within(needsYou).getByText('Stove & counters')).toBeInTheDocument()
    expect(within(needsYou).getByText(/Confirm \$12\.00 from Noah/)).toBeInTheDocument()

    await user.click(within(needsYou).getByRole('button', { name: 'Mark done: Stove & counters' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Task checked off')
    expect(within(needsYou).queryByText('Stove & counters')).not.toBeInTheDocument()
  })

  it('counts what is waiting on the member in the navigation', () => {
    renderInHouse('/', <OverviewPage />)
    const rail = screen.getAllByRole('navigation', { name: 'Primary' })[0]
    // Three votes and one chore under Chores, one payment to confirm under Money.
    expect(within(rail).getByRole('link', { name: 'Chores, 4 waiting on you' })).toBeInTheDocument()
    expect(within(rail).getByRole('link', { name: 'Money, 1 waiting on you' })).toBeInTheDocument()
    expect(within(rail).getByRole('link', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('keeps the chore dialogs working behind the new chores layout', async () => {
    const user = userEvent.setup()
    renderInHouse('/chores', <ChoresPage />)

    expect(await screen.findByRole('region', { name: 'Coming up' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Who did what' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New chore' }))
    expect(screen.getByRole('dialog', { name: 'Create a chore' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Repeats' })).toBeInTheDocument()
  })

  it('runs a routine’s menu from the keyboard and asks before deleting', async () => {
    const user = userEvent.setup()
    renderInHouse('/chores', <ChoresPage />)

    const trigger = await screen.findByRole('button', { name: 'Actions for Stove & counters' })
    await user.click(trigger)
    const menu = screen.getByRole('menu', { name: 'Actions for Stove & counters' })
    // The menu takes focus, and the arrow keys move through it.
    expect(within(menu).getByRole('menuitem', { name: 'Pause' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toHaveFocus()

    // Escape closes it and hands focus back to the button that opened it.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Stove & counters?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Closing the dialog puts focus back on the menu button it came from.
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('moves focus into a classic dialog opened from a menu, and back out when it closes', async () => {
    const user = userEvent.setup()
    renderInHouse('/chores', <ChoresPage />)

    const trigger = await screen.findByRole('button', { name: 'Actions for Stove & counters' })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit chore' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('shows money with the shared purchase and bill dialogs still attached', async () => {
    const user = userEvent.setup()
    renderInHouse('/money', <MoneyPage />)

    expect(await screen.findByRole('region', { name: 'Your balance' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add purchase' }))
    expect(screen.getByRole('dialog', { name: 'Add a shared purchase' })).toBeInTheDocument()
  })

  it('keeps each roommate’s balance readable as a table row, with a button to open it', async () => {
    const user = userEvent.setup()
    renderInHouse('/money', <MoneyPage />)

    const balances = await screen.findByRole('region', { name: 'Balances' })
    const row = within(balances).getByRole('row', { name: /Maya/ })
    expect(within(row).getAllByRole('cell').length).toBeGreaterThan(1)
    expect(within(row).getByText('-$828.34')).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'View balance for Maya' }))
    expect(screen.getByRole('dialog', { name: 'Maya\'s balance' })).toBeInTheDocument()
  })

  it('asks for a reason in a dialog before deleting a charge', async () => {
    const user = userEvent.setup()
    renderInHouse('/money', <MoneyPage />)

    await user.click(await screen.findByRole('button', { name: 'Delete charge Kitchen spices' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Kitchen spices?' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete charge' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: 'Why are you deleting it?' }), 'Entered twice')
    await user.click(confirm)
    expect(await screen.findByText(/Kitchen spices \(deleted\)/)).toBeInTheDocument()
  })
})

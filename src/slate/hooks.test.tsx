import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useDialogFocus } from './hooks'

/** A page with a field, two ways to open a dialog, and a dialog that does not manage focus itself. */
function Page() {
  useDialogFocus()
  const [open, setOpen] = useState(false)
  return (
    <>
      <input aria-label="Username" />
      <button type="button" onClick={() => setOpen(true)}>Open from a button</button>
      <div data-testid="row" onClick={() => setOpen(true)}>Open from a row</div>
      {open && (
        <section role="dialog" aria-modal="true" aria-label="Details">
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </section>
      )}
    </>
  )
}

describe('useDialogFocus', () => {
  it('moves focus into a dialog and back to the button that opened it', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'Open from a button' })

    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Details' })
    await waitFor(() => expect(dialog).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('returns to a button that was pressed but never focused, as Safari does', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const field = screen.getByRole('textbox', { name: 'Username' })
    const opener = screen.getByRole('button', { name: 'Open from a button' })
    await user.click(field)

    // Safari fires the press and the click without moving focus to the button.
    fireEvent.pointerDown(opener)
    fireEvent.click(opener)
    expect(field).toHaveFocus()
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Details' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('does not send focus back to an older element when the dialog was opened from something unfocusable', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const field = screen.getByRole('textbox', { name: 'Username' })
    await user.click(field)

    await user.click(screen.getByTestId('row'))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Details' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(field).not.toHaveFocus()
  })
})

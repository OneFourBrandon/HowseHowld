import { expect, test } from '@playwright/test'

test('navigates the complete demo household', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()

  await page.getByRole('link', { name: /Chores/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible()

  await page.getByRole('link', { name: /Money/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Shared money' })).toBeVisible()

  await page.getByRole('link', { name: /Calendar/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible()

  await page.getByRole('link', { name: /Driveway/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Driveway', exact: true })).toBeVisible()
})

test('exposes the complete creation controls', async ({ page }) => {
  await page.goto('/chores')
  await page.getByRole('button', { name: 'New chore' }).click()
  await expect(page.getByRole('combobox', { name: 'Repeats' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Rotation order and eligibility' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/money')
  await page.getByRole('button', { name: 'Add purchase' }).click()
  await expect(page.getByRole('group', { name: 'Who paid?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Custom shares' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/calendar')
  const addEventButton = page.getByRole('button', { name: 'Add event' })
  await addEventButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('checkbox', { name: 'All-day event' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Audience' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/driveway')
  await page.getByRole('button', { name: 'Manage vehicles' }).click()
  await page.getByRole('button', { name: 'Add vehicle' }).click()
  await expect(page.getByRole('textbox', { name: 'Vehicle name' })).toBeVisible()
})

test('admin edits a chore schedule and details from the routine card', async ({ page }) => {
  await page.goto('/chores')
  const routine = page.locator('.routine-row').first()
  const title = await routine.locator('strong').first().textContent()
  await routine.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit chore' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Chore name' })).toHaveValue(title ?? '')
  await page.getByRole('textbox', { name: 'Details' }).fill('Wipe the counters and clean the sink.')
  await page.getByRole('combobox', { name: 'Repeats' }).selectOption('weekly')
  await page.getByRole('textbox', { name: 'Starts on' }).fill('2026-10-01')
  await page.getByRole('textbox', { name: 'Due time' }).fill('20:30')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Edit chore' })).toBeHidden()
  await expect(routine).toContainText('8:30 PM')
  await routine.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('textbox', { name: 'Details' })).toHaveValue('Wipe the counters and clean the sink.')
  await expect(page.getByRole('textbox', { name: 'Starts on' })).toHaveValue('2026-10-01')
})

test('bill edit controls are visible and open the editor', async ({ page }) => {
  await page.goto('/money')
  const edit = page.getByRole('button', { name: /^Edit .+/ }).first()
  await expect(edit).toBeVisible()
  await edit.click()
  await expect(page.getByRole('button', { name: 'Save bill' })).toBeVisible()
})

test('future bill prices do not change past months and variable prices stay pending', async ({ page }) => {
  await page.goto('/money')
  await page.getByRole('button', { name: 'Next month' }).click()
  await page.getByRole('button', { name: 'Edit Monthly rent' }).click()
  await page.getByRole('spinbutton', { name: /Amount for/ }).fill('3300.00')
  await page.getByRole('button', { name: 'Save bill' }).click()
  await expect(page.getByText('$3,300.00')).toBeVisible()
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByText('$3,200.00')).toBeVisible()

  await page.getByRole('button', { name: 'Add bill' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Hydro')
  await page.getByRole('spinbutton', { name: /Household amount/ }).fill('100.00')
  await page.getByRole('checkbox', { name: /Require a new price every month before/ }).check()
  await page.getByRole('button', { name: 'Add monthly bill' }).click()
  await expect(page.getByText('Hydro')).toBeVisible()
  await expect(page.locator('#bills').getByText('Pending')).toBeVisible()

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(page.locator('#bills').getByText('Pending')).toBeVisible()
  await page.getByRole('button', { name: 'Edit Hydro' }).click()
  await page.getByRole('spinbutton', { name: /Amount for/ }).fill('125.00')
  await page.getByRole('button', { name: 'Save bill' }).click()
  await expect(page.getByText('$125.00')).toBeVisible()
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.locator('#bills').getByText('Pending')).toBeVisible()
})

import { expect, test } from '@playwright/test'

test('navigates the complete demo household', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()

  await page.getByRole('link', { name: /Chores/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible()

  await page.getByRole('link', { name: /Money/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Shared money' })).toBeVisible()

  await page.getByRole('link', { name: /Calendar/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()

  await page.getByRole('link', { name: /Driveway/ }).last().click()
  await expect(page.getByRole('heading', { name: 'Driveway' })).toBeVisible()
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
  await expect(page.getByRole('checkbox', { name: 'Enter custom shares' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/calendar')
  await page.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByRole('checkbox', { name: 'All-day event' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Audience' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/driveway')
  await page.getByRole('button', { name: 'Add vehicle' }).click()
  await expect(page.getByRole('textbox', { name: 'Vehicle name' })).toBeVisible()
})

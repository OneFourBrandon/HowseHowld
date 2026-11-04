import { expect, test } from '@playwright/test'

const photo = 'public/og.png'

test('a roommate claims a missed chore with before and after photos', async ({ page }) => {
  await page.goto('/chores')
  const grabs = page.getByRole('region', { name: 'Up for grabs' })
  await expect(grabs.getByText('Noah missed it')).toBeVisible()

  await grabs.getByRole('button', { name: 'Cover chore' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cover this chore' })
  await expect(dialog.getByRole('button', { name: 'Claim chore' })).toBeDisabled()
  await dialog.locator('input[type="file"]').setInputFiles(photo)
  await expect(dialog.getByRole('img', { name: 'Take the before photo preview' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Claim chore' }).click()
  await expect(dialog).toBeHidden()
  await expect(grabs.getByText('You’re covering this for Noah')).toBeVisible()

  await grabs.getByRole('button', { name: 'Finish' }).click()
  const finish = page.getByRole('dialog', { name: 'Finish and submit' })
  await finish.locator('input[type="file"]').setInputFiles(photo)
  await finish.getByRole('button', { name: 'Submit for review' }).click()
  await expect(finish).toBeHidden()
  await expect(grabs).toHaveCount(0)

  const card = page.locator('.infraction-card').filter({ hasText: 'Dishes & drying rack' })
  await expect(card.getByText('You’re covering this for $10.00')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('an uninvolved roommate decides a submitted claim', async ({ page }) => {
  await page.goto('/chores')
  const card = page.locator('.infraction-card').filter({ hasText: 'Wipe out the fridge' })
  await expect(card.getByText('Liam’s note')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Forgive infraction' })).toHaveCount(0)
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(card.getByText('Maya covered this and earned $10.00')).toBeVisible()
  await expect(card).toContainText('Covered')
})

test('the admin sets the household grace period', async ({ page }) => {
  await page.goto('/settings')
  const select = page.getByRole('combobox', { name: /Grace period/ })
  await expect(select).toHaveValue('240')
  await select.selectOption('120')
  await expect(page.getByText('can be finished until 1:59 AM')).toBeVisible()
  await page.getByRole('button', { name: 'Save grace period' }).click()
  await expect(page.getByRole('button', { name: 'Save grace period' })).toBeDisabled()
  await page.getByRole('link', { name: /Chores/ }).last().click()
  await expect(page.getByText('Chores get 2 hours of grace before they count as missed.')).toBeVisible()
})

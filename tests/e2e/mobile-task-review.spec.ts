import { expect, test } from '@playwright/test'

test('mobile roommate can review a missed chore and admin can forgive it', async ({ page }) => {
  await page.goto('/chores')
  const card = page.locator('.infraction-card').filter({ hasText: 'Vacuum the kitchen' })
  await expect(card.getByRole('button', { name: 'Excuse', exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Uphold', exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Excuse', exact: true }).click()
  await expect(card).toContainText('Excused')
  await expect(card.getByRole('button', { name: 'Forgive infraction' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('admin forgiveness works from the mobile infraction card', async ({ page }) => {
  await page.goto('/chores')
  const card = page.locator('.infraction-card').filter({ hasText: 'Vacuum the kitchen' })
  await card.getByRole('button', { name: 'Forgive infraction' }).click()
  await expect(card).toContainText('Excused')
  await expect(card.getByRole('button', { name: 'Forgive infraction' })).toHaveCount(0)
})

test('mobile purchase list shows the member share before opening a purchase', async ({ page }) => {
  await page.goto('/money')
  const purchase = page.getByRole('button', { name: 'View breakdown for Toilet paper & paper towel' })
  await expect(purchase.getByText('Your share $12.09')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

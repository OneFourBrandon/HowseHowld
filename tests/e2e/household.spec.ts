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

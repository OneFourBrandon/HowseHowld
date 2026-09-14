import { expect, test } from '@playwright/test'

test('a roommate edits another member’s payer and share split', async ({ page }) => {
  await page.goto('/money')
  await page.getByRole('button', { name: 'View breakdown for Kitchen spices' }).click()
  await expect(page.getByRole('button', { name: 'Edit price', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit who paid', exact: true }).click()
  const form = page.getByRole('dialog').locator('form')
  for (const box of await form.getByRole('checkbox').all()) await box.uncheck()
  await form.getByRole('checkbox', { name: /Brandon/ }).check()
  await form.getByRole('button', { name: 'Save who paid' }).click()
  await expect(page.getByRole('heading', { name: 'Who paid', exact: true }).locator('..')).toContainText('Brandon')
  await page.getByRole('button', { name: 'Edit shares', exact: true }).click()
  for (const box of await form.getByRole('checkbox').all()) await box.uncheck()
  await form.getByRole('checkbox', { name: /Maya/ }).check()
  await form.getByRole('button', { name: 'Save shares' }).click()
  await expect(page.getByRole('dialog')).toContainText('Split 1 ways')
})

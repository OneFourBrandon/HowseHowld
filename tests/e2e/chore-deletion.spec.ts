import { expect, test } from '@playwright/test'

test('deleting a routine requires confirmation and removes its card', async ({ page }) => {
  await page.goto('/chores')
  const rows = page.locator('.routine-row')
  await expect(rows.first()).toBeVisible()
  const count = await rows.count()
  page.once('dialog', dialog => dialog.dismiss())
  await rows.first().getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(rows).toHaveCount(count)
  page.once('dialog', dialog => dialog.accept())
  await rows.first().getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(rows).toHaveCount(count - 1)
})

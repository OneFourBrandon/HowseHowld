import { expect, test } from '@playwright/test'

test('opens own and roommate balance histories with payment filters', async ({ page }) => {
  await page.goto('/money')
  await page.getByRole('button', { name: 'View balance for Brandon' }).click()
  const dialog = page.getByRole('dialog', { name: "Brandon's balance" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Monthly rent', { exact: true }).first()).toBeVisible()
  await dialog.getByRole('button', { name: 'Payments', exact: true }).click()
  await expect(dialog.getByText('Received from Noah')).toBeVisible()
  await expect(dialog.getByText('pending', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Monthly rent', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'View balance for Noah' }).click()
  const other = page.getByRole('dialog', { name: "Noah's balance" })
  await other.getByRole('button', { name: 'Payments', exact: true }).click()
  await expect(other.getByText('Sent to Brandon')).toBeVisible()
  await expect(other.getByText('pending', { exact: true })).toBeVisible()
})

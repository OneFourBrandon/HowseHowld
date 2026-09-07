import { expect, test } from '@playwright/test'

test('purchase price opens a complete share breakdown on touch', async ({ page }) => {
  await page.goto('/money')
  await page.getByRole('button', { name: /Show shares for/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Who owes what' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Who paid', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('night palette persists without changing the mobile day count', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('howsehowld:theme', 'light'))
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Visible dates' }).getByRole('button')).toHaveCount(3)
  await page.getByRole('button', { name: 'Use dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: /Money/ }).last().click()
  await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('howsehowld:theme'))).toBe('dark')
})

test('owner saves driveway columns and garage configuration', async ({ page }) => {
  await page.goto('/driveway')
  await page.getByRole('combobox', { name: 'Cars wide' }).selectOption('2')
  await page.getByRole('combobox', { name: 'Garage rows' }).selectOption('1')
  await page.getByRole('button', { name: 'Save layout' }).click()
  await expect(page.getByText('Garage · 1 row × 2 spaces', { exact: false })).toBeVisible()
  expect(await page.locator('.driveway-lane').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('correcting a purchase updates every share and the displayed total', async ({ page }) => {
  await page.goto('/money')
  await page.getByRole('button', { name: 'Show shares for Toilet paper & paper towel' }).click()
  await page.getByRole('button', { name: 'Edit price' }).click()
  await page.getByRole('textbox', { name: 'Correct purchase total' }).fill('40.04')
  await page.getByRole('button', { name: 'Save total' }).click()
  await expect(page.getByRole('dialog').getByText('$40.04', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('dialog').getByText('$40.04', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('dialog').getByText('$10.01', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show shares for Toilet paper & paper towel' })).toContainText('$40.04')
})

test('desktop hover shows shares and both palettes render', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/money')
  await page.getByRole('button', { name: 'Show shares for Toilet paper & paper towel' }).hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('money-hover.png') })
  await page.getByRole('button', { name: 'Show shares for Toilet paper & paper towel' }).click()
  await page.screenshot({ path: testInfo.outputPath('purchase-detail.png') })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  const toggle = page.getByRole('button', { name: 'Use dark mode' })
  if (await toggle.isVisible()) await toggle.click()
  await page.screenshot({ path: testInfo.outputPath('money-dark.png') })
})

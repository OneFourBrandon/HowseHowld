import { expect, test } from '@playwright/test'

test('production service worker installs and controls a fresh browser', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.state
  }), { timeout: 20_000 }).toBe('activated')
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.reload()
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
})

import { expect, test, type Page } from '@playwright/test'

// These run against the production build, where the new design's stylesheet is
// a separate file fetched on demand. The dev server injects styles differently,
// so the end-to-end suite cannot see how that loading behaves.
test.use({ serviceWorkers: 'block' })

/** slate.css sets this on the root element, so it tells us whether that stylesheet is applied. */
const slateStylesheetApplied = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sl-loaded').trim() === '1')

const storeSlate = (page: Page) => page.addInitScript(() => {
  localStorage.setItem('howsehowld:design', 'slate')
})

test('a device that never turned the new design on does not load its stylesheet', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('html')).toHaveAttribute('data-design', 'classic')
  expect(await slateStylesheetApplied(page)).toBe(false)
})

test('a device with the new design stored opens in it, styled, from a cold start', async ({ page }) => {
  await storeSlate(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('html')).toHaveAttribute('data-design', 'slate')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await slateStylesheetApplied(page)).toBe(true)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101113')
})

test('shows classic for the visit when the new design’s stylesheet cannot be fetched', async ({ page }) => {
  await storeSlate(page)
  // Let the main stylesheet through and fail every stylesheet requested after it.
  let mainStylesheetSeen = false
  await page.route('**/*.css', (route) => {
    if (mainStylesheetSeen) return route.abort()
    mainStylesheetSeen = true
    return route.continue()
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('html')).toHaveAttribute('data-design', 'classic')
  expect(await slateStylesheetApplied(page)).toBe(false)
  // The choice itself is kept, so the next visit tries again.
  expect(await page.evaluate(() => localStorage.getItem('howsehowld:design'))).toBe('slate')
})

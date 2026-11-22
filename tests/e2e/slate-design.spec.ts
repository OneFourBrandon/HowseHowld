import { expect, test, type Page } from '@playwright/test'

// The demo house keeps Toronto time, but its sample data is dated from the device's clock.
// On a device in another zone, such as CI in UTC, "today's" sample chore can fall on the
// household's tomorrow. These tests are about what today shows, so run them in the house's zone.
test.use({ timezoneId: 'America/Toronto' })

const useSlate = (page: Page) => page.addInitScript(() => {
  localStorage.setItem('howsehowld:design', 'slate')
})

test('the classic design stays the default', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-design', 'classic')
  // This can be the first page a cold dev server compiles, so allow for that.
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible({ timeout: 15_000 })
})

test('the new design is switched on and off from Settings and survives a reload', async ({ page }) => {
  await page.goto('/settings')
  const toggle = page.getByRole('switch', { name: 'New design' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()

  await expect(page.locator('html')).toHaveAttribute('data-design', 'slate')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Appearance' })).toBeVisible()

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'slate')
  await expect(page.getByRole('region', { name: 'Appearance' })).toBeVisible()

  await page.getByRole('switch', { name: 'New design' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-design', 'classic')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'New design' })).toHaveAttribute('aria-checked', 'false')
})

test('the new design keeps its own theme', async ({ page }) => {
  await useSlate(page)
  await page.goto('/settings')
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Light' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('every page opens in the new design without the screen scrolling sideways', async ({ page }) => {
  await useSlate(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))

  for (const [path, title, landmark] of [
    ['/', 'Overview', 'Needs you'],
    ['/chores', 'Chores', 'Coming up'],
    ['/money', 'Money', 'Your balance'],
    ['/calendar', 'Calendar', 'Imported calendars'],
    ['/driveway', 'Driveway', 'Upcoming exits'],
    ['/settings', 'Settings', 'Appearance'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('region', { name: landmark })).toBeVisible()
    // Wide tables and the driveway board may scroll inside their own panel; nothing else may stick out.
    const stickingOut = await page.evaluate(() => {
      const scrollsInside = (node: Element) => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth) return true
        }
        return false
      }
      return [...document.querySelectorAll('.sl-app *:not(.sr-only)')]
        .filter(node => {
          const box = node.getBoundingClientRect()
          return box.width > 0 && box.right > window.innerWidth + 0.5 && !scrollsInside(node)
        })
        .map(node => `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 60)}`)
    })
    expect(stickingOut, `${path} is wider than the screen`).toEqual([])
  }
  expect(errors).toEqual([])
})

test('a chore is finished from the list of things waiting on you', async ({ page }) => {
  await useSlate(page)
  await page.goto('/')
  const needsYou = page.getByRole('region', { name: 'Needs you' })
  await expect(needsYou.getByText('Stove & counters')).toBeVisible()
  await needsYou.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.getByText('Task checked off. Nice work.')).toBeVisible()
  await expect(needsYou.getByText('Stove & counters')).toHaveCount(0)
})

test('New opens the right dialog on the right page', async ({ page }) => {
  await useSlate(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Shared purchase' }).click()
  await expect(page).toHaveURL(/\/money$/)
  await expect(page.getByRole('dialog', { name: 'Add a shared purchase' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Chore' }).click()
  await expect(page).toHaveURL(/\/chores$/)
  await expect(page.getByRole('dialog', { name: 'Create a chore' })).toBeVisible()
})

test('the calendar shows every kind of day and filters by layer', async ({ page }) => {
  await useSlate(page)
  await page.goto('/calendar')
  const day = page.getByRole('region', { name: 'Today' })
  await expect(day.getByText('Stove & counters')).toBeVisible()
  await expect(day.getByText('CSC 209 lecture')).toBeVisible()

  await page.getByRole('group', { name: 'Show on the calendar' }).getByRole('button', { name: 'Chores' }).click()
  await expect(day.getByText('Stove & counters')).toHaveCount(0)
  await expect(day.getByText('CSC 209 lecture')).toBeVisible()
})

test('a payment is deleted with a reason from the money page', async ({ page }) => {
  await useSlate(page)
  await page.goto('/money')
  await expect(page.getByText('Payment from Noah')).toBeVisible()
  await page.getByRole('button', { name: 'Delete payment from Noah to Brandon' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete this payment?' })
  await dialog.getByRole('textbox', { name: 'Why are you deleting it?' }).fill('Recorded by mistake')
  await dialog.getByRole('button', { name: 'Delete payment' }).click()
  await expect(page.getByText('Payment from Noah')).toHaveCount(0)
  await expect(page.getByText('Payment deleted and balances updated.')).toBeVisible()
})

import { test, expect, type BrowserContext } from '@playwright/test'

// Real supabase-js + browser storage, deterministic Auth API (no real emails or production accounts).
test('anonymous linking, second-device OTP, persistence, local logout, and invalid codes', async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  let user = { id: '00000000-0000-0000-0000-000000000123', aud: 'authenticated', role: 'authenticated', is_anonymous: true, email: '', email_confirmed_at: '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const requested: boolean[] = []
  const logoutScopes: string[] = []
  let joined = false
  let anonymousSignups = 0
  const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`
  const session = () => ({ access_token: token(), refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })
  async function setup(context: BrowserContext) {
    await context.route('http://127.0.0.1:54399/**', async route => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const body = method === 'GET' ? {} : route.request().postDataJSON() ?? {}
      let response: unknown = {}
      let status = 200
      if (url.pathname.endsWith('/otp')) {
        requested.push(body.create_user)
        if (body.email !== user.email && !body.create_user) { status = 422; response = { msg: 'Signups not allowed for otp', code: 'otp_disabled' } }
      } else if (url.pathname.endsWith('/signup') || url.pathname.endsWith('/token')) { if (url.pathname.endsWith('/signup')) anonymousSignups++; response = session() }
      else if (url.pathname.endsWith('/user')) response = user
      else if (url.pathname.endsWith('/verify')) {
        if (body.token !== '123456') { status = 403; response = { msg: 'Token has expired or is invalid', code: 'otp_expired' } }
        else {
          if (body.type === 'email_change') user = { ...user, is_anonymous: false, email: body.email, email_confirmed_at: new Date().toISOString() }
          response = session()
        }
      } else if (url.pathname.endsWith('/logout')) { logoutScopes.push(url.searchParams.get('scope')!); status = 204 }
      else if (url.pathname.endsWith('/household_members')) response = joined ? [{ id: 'same-membership' }] : []
      else if (url.pathname.endsWith('/join_household_by_code')) {
        // Simulate the database committing while the gateway loses its response.
        joined = true; status = 503; response = { message: 'Network interrupted. Retry joining.' }
      }
      else throw new Error(`Unexpected mock API request: ${url.pathname}`)
      await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(response) })
    })
  }
  try {
    await setup(first); await setup(second)
    const a = await first.newPage(), b = await second.newPage()
    await a.goto('/tests/auth/harness.html')
    await a.getByRole('button', { name: 'Join a house', exact: true }).click()
    await a.getByLabel('House code', { exact: true }).fill('HOUSE-TEST')
    await a.getByLabel('Your name').fill('Roommate')
    await a.getByRole('button', { name: 'Join the house', exact: true }).click()
    await expect(a.getByRole('alert')).toContainText('Could not connect')
    await a.getByRole('button', { name: 'Join the house', exact: true }).click()
    await expect(a.getByTestId('identity')).toHaveText(user.id)
    expect(anonymousSignups).toBe(1)
    await a.getByRole('button', { name: 'Later', exact: true }).click()
    await a.reload()
    await expect(a.getByText('Protect your account', { exact: true })).toHaveCount(1)
    await a.getByLabel('Recovery email', { exact: true }).fill('roommate@example.com')
    await a.getByRole('button', { name: 'Send code', exact: true }).click()
    await expect(a.getByRole('button', { name: /Resend in/ })).toBeDisabled()
    await a.getByRole('button', { name: 'Change email' }).click()
    await a.getByLabel('Recovery email', { exact: true }).fill('roommate@example.com')
    await expect(a.getByRole('button', { name: 'Send code', exact: true })).toBeEnabled()
    await a.getByRole('button', { name: 'Send code', exact: true }).click()
    await a.getByLabel('Six-digit verification code').fill('123456')
    await a.getByRole('button', { name: 'Verify email', exact: true }).click()
    await expect(a.getByText(/Email sign-in enabled/)).toBeVisible()
    await expect(a.getByTestId('identity')).toHaveText(user.id)
    await b.goto('/tests/auth/harness.html')
    await b.getByLabel('Email address').fill('roommate@example.com')
    await b.getByRole('button', { name: 'Email me a code' }).click()
    await b.getByLabel('Six-digit code', { exact: true }).fill('000000')
    await b.getByRole('button', { name: 'Verify and continue' }).click()
    await expect(b.getByRole('alert')).toContainText('invalid or expired')
    await b.getByLabel('Six-digit code', { exact: true }).fill('123456')
    await b.getByRole('button', { name: 'Verify and continue' }).click()
    await expect(b.getByTestId('identity')).toHaveText(user.id)
    await b.reload()
    await expect(b.getByTestId('identity')).toHaveText(user.id)
    await a.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(a.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await b.reload()
    await expect(b.getByTestId('identity')).toHaveText(user.id)
    expect(logoutScopes).toEqual(['local'])
    expect(requested).toEqual([false])
    await a.getByLabel('Email address').fill('unknown@example.com')
    await a.getByRole('button', { name: 'Email me a code' }).click()
    await expect(a.getByRole('alert')).toContainText('No sign-in account was found')
  } finally { await first.close(); await second.close() }
})

test('recovery sign-in handles invalid codes, retries on the same identity, then persists', async ({ browser }) => {
  const context = await browser.newContext()
  const id = '00000000-0000-0000-0000-000000000456'
  const user = { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, email: '', email_confirmed_at: '', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  let signedIn = false
  let recovered = false
  let anonymousSignups = 0
  let redemptions = 0
  const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`
  const session = () => ({ access_token: token(), refresh_token: 'recovery-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })
  await context.route('http://127.0.0.1:54399/**', async route => {
    const url = new URL(route.request().url())
    const body = route.request().method() === 'GET' ? {} : route.request().postDataJSON() ?? {}
    let response: unknown = {}
    let status = 200
    if (url.pathname.endsWith('/signup')) { signedIn = true; anonymousSignups++; response = session() }
    else if (url.pathname.endsWith('/token')) response = session()
    else if (url.pathname.endsWith('/user')) response = user
    else if (url.pathname.endsWith('/household_members')) response = recovered ? [{ id: 'recovered-membership' }] : []
    else if (url.pathname.endsWith('/join_household_by_code')) {
      redemptions++
      if (body.p_code === 'REC-VALID-1234') recovered = true
      else { status = 400; response = { message: 'Share code is invalid' } }
    } else if (url.pathname.endsWith('/logout')) { signedIn = false; status = 204 }
    else throw new Error(`Unexpected mock API request: ${url.pathname}`)
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(response) })
  })
  try {
    const page = await context.newPage()
    await page.goto('/tests/auth/harness.html')
    await page.getByRole('button', { name: 'Use a recovery code instead' }).click()
    await page.getByLabel('Recovery code').fill('REC-WRONG-1234')
    await page.getByRole('button', { name: 'Restore my account' }).click()
    await expect(page.getByRole('alert')).toContainText('recovery code is invalid or expired')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Restore your account' })).toBeVisible()
    await page.getByLabel('Recovery code').fill('REC-VALID-1234')
    await page.getByRole('button', { name: 'Restore my account' }).click()
    await expect(page.getByTestId('identity')).toHaveText(id)
    expect(anonymousSignups).toBe(1)
    expect(redemptions).toBe(2)
    await page.reload()
    await expect(page.getByTestId('identity')).toHaveText(id)
    expect(signedIn).toBe(true)
  } finally { await context.close() }
})

test('sign-in and account creation allow correcting an email immediately', async ({ browser }) => {
  const context = await browser.newContext()
  const email = 'owner@example.com'
  const user = { id: '00000000-0000-0000-0000-000000000789', aud: 'authenticated', role: 'authenticated', is_anonymous: false, email, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  const requested: Array<{ email: string; create: boolean }> = []
  const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`
  const session = () => ({ access_token: token(), refresh_token: 'create-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user })
  await context.route('http://127.0.0.1:54399/**', async route => {
    const url = new URL(route.request().url())
    const body = route.request().method() === 'GET' ? {} : route.request().postDataJSON() ?? {}
    let response: unknown = {}
    let status = 200
    if (url.pathname.endsWith('/otp')) requested.push({ email: body.email, create: body.create_user })
    else if (url.pathname.endsWith('/verify')) response = session()
    else if (url.pathname.endsWith('/user')) response = user
    else if (url.pathname.endsWith('/token')) response = session()
    else throw new Error(`Unexpected mock API request: ${url.pathname}`)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(response) })
  })
  try {
    const page = await context.newPage()
    await page.goto('/tests/auth/harness.html')
    await page.getByLabel('Email address').fill('typo@example.com')
    await page.getByRole('button', { name: 'Email me a code' }).click()
    await page.getByRole('button', { name: 'Use another email' }).click()
    await page.getByLabel('Email address').fill(email)
    await expect(page.getByRole('button', { name: 'Email me a code' })).toBeEnabled()
    await page.getByRole('button', { name: 'Create a house' }).click()
    await page.getByRole('button', { name: 'Email me a code' }).click()
    await page.getByLabel('Six-digit code').fill('123456')
    await page.getByRole('button', { name: 'Verify and continue' }).click()
    await expect(page.getByTestId('identity')).toHaveText(user.id)
    expect(requested).toEqual([{ email: 'typo@example.com', create: false }, { email, create: true }])
  } finally { await context.close() }
})

import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../functions/_middleware'
describe('canonical host redirect', () => {
  it.each(['howsehowld.pages.dev', 'preview.howsehowld.pages.dev'])('redirects %s preserving path and query', async host => {
    const next = vi.fn()
    const response = await onRequest({ request: new Request(`https://${host}/money?month=2026-09&code=abc`), next })
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://howse.brandon-barker.ca/money?month=2026-09&code=abc')
    expect(next).not.toHaveBeenCalled()
  })
  it.each(['howse.brandon-barker.ca', 'localhost:5173'])('leaves %s untouched', async host => {
    const next = vi.fn().mockResolvedValue(new Response('app'))
    await onRequest({ request: new Request(`https://${host}/`), next })
    expect(next).toHaveBeenCalledOnce()
  })
})

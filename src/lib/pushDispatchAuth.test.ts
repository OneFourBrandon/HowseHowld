import { describe, expect, it, vi } from 'vitest'
import { isDispatchAuthorized } from '../../supabase/functions/push-dispatch/dispatch-auth'

const secret = 'a'.repeat(64)
describe('scheduled push authentication', () => {
  it('accepts the Vault credential even without an Edge environment credential', async () => {
    const verify = vi.fn().mockResolvedValue(true)
    expect(await isDispatchAuthorized(secret, undefined, verify)).toBe(true)
    expect(verify).toHaveBeenCalledWith(secret)
  })
  it('keeps existing environment authentication working', async () => {
    const verify = vi.fn()
    expect(await isDispatchAuthorized(secret, secret, verify)).toBe(true)
    expect(verify).not.toHaveBeenCalled()
  })
  it('rejects missing and short credentials before database access', async () => {
    const verify = vi.fn()
    expect(await isDispatchAuthorized(null, undefined, verify)).toBe(false)
    expect(await isDispatchAuthorized('short', undefined, verify)).toBe(false)
    expect(verify).not.toHaveBeenCalled()
  })
  it('rejects an incorrect credential', async () => {
    expect(await isDispatchAuthorized(secret, 'b'.repeat(64), async () => false)).toBe(false)
  })
  it('does not treat database verification failures as authorization', async () => {
    await expect(isDispatchAuthorized(secret, undefined, async () => { throw new Error('Unavailable') })).rejects.toThrow('Unavailable')
  })
})

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider, authMessage, useAuth } from './AuthContext'

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), signInWithOtp: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), refreshSession: vi.fn(), getUser: vi.fn(),
  listener: (_event: string, _session: Session | null) => {},
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { ...mock, onAuthStateChange: (callback: typeof mock.listener) => {
  mock.listener = callback
  return { data: { subscription: { unsubscribe: vi.fn() } } }
} } } }))
const session = { user: { id: 'same-user', is_anonymous: true }, access_token: 'test' } as Session
beforeEach(() => { vi.clearAllMocks(); mock.getSession.mockResolvedValue({ data: { session }, error: null }) })
afterEach(cleanup)
describe('authentication lifecycle', () => {
  it('does not mistake a failed INITIAL_SESSION event for a logout', async () => {
    mock.getSession.mockRejectedValue(new Error('Network unavailable'))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await act(async () => { mock.listener('INITIAL_SESSION', null) })
    expect(result.current?.error).toMatch(/reconnect/)
    expect(result.current?.loading).toBe(false)
  })
  it('keeps the session during transient network failures, then reconnects', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    mock.getSession.mockRejectedValueOnce(new Error('Network unavailable'))
    await act(async () => { window.dispatchEvent(new Event('online')) })
    expect(result.current?.session?.user.id).toBe('same-user')
    expect(result.current?.error).toMatch(/reconnect/)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(result.current?.error).toBe('')
  })
  it('ignores a stale session read after Supabase confirms sign-out', async () => {
    let resolve!: (value: unknown) => void
    mock.getSession.mockReturnValue(new Promise(done => { resolve = done }))
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await act(async () => { mock.listener('SIGNED_OUT', null); resolve({ data: { session } }) })
    expect(result.current?.session).toBeNull()
    expect(result.current?.loading).toBe(false)
  })
  it('shows no session only after a successful absent-session result', async () => {
    mock.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current?.loading).toBe(false))
    expect(result.current?.session).toBeNull()
    expect(result.current?.error).toBe('')
  })
  it('does not create users through Sign in; Create house opts in explicitly', async () => {
    mock.signInWithOtp.mockResolvedValue({ error: null })
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await act(async () => { await result.current!.sendCode(' Person@Example.com ') })
    expect(mock.signInWithOtp).toHaveBeenLastCalledWith({ email: 'person@example.com', options: { shouldCreateUser: false } })
    await act(async () => { await result.current!.sendCode('owner@example.com', true) })
    expect(mock.signInWithOtp).toHaveBeenLastCalledWith({ email: 'owner@example.com', options: { shouldCreateUser: true } })
  })
  it('verifies a linked email on the same identity and refreshes the anonymous claim', async () => {
    const verified = { ...session, user: { ...session.user, is_anonymous: false, email_confirmed_at: '2026-09-08' } }
    mock.updateUser.mockResolvedValue({ error: null })
    mock.verifyOtp.mockResolvedValue({ error: null })
    mock.refreshSession.mockResolvedValue({ data: { session: verified }, error: null })
    mock.getUser.mockResolvedValue({ data: { user: verified.user }, error: null })
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current?.user?.id).toBe('same-user'))
    await act(async () => { await result.current!.linkEmail('person@example.com'); await result.current!.verifyEmail('person@example.com', '123456') })
    expect(mock.updateUser).toHaveBeenCalledWith({ email: 'person@example.com' })
    expect(mock.verifyOtp).toHaveBeenCalledWith({ email: 'person@example.com', token: '123456', type: 'email_change' })
    expect(result.current?.user?.id).toBe('same-user')
    expect(result.current?.emailVerified).toBe(true)
  })
  it('does not report success if the linked identity is still anonymous', async () => {
    mock.verifyOtp.mockResolvedValue({ error: null })
    mock.refreshSession.mockResolvedValue({ data: { session }, error: null })
    mock.getUser.mockResolvedValue({ data: { user: session.user }, error: null })
    const { result } = renderHook(useAuth, { wrapper: AuthProvider })
    await waitFor(() => expect(result.current?.user).toBeDefined())
    await expect(result.current!.verifyEmail('person@example.com', '123456')).rejects.toThrow(/not complete/)
  })
  it.each(['Token has expired', 'Invalid OTP', 'Too many requests', 'Network fetch failed'])('explains %s', message => {
    expect(authMessage({ message })).not.toBe(message)
  })
})

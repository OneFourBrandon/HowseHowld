import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ProfileGate } from './ProfileGate'
const profile = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ hasSupabaseConfig: true }))
vi.mock('../lib/api', () => ({ getCurrentProfile: profile, updateCurrentProfile: vi.fn() }))
afterEach(cleanup)
it('recovered completed profiles skip the name/avatar onboarding', async () => {
  profile.mockResolvedValue({ id: 'restored', displayName: 'Original name', avatarUrl: '/original.jpg', onboardingCompletedAt: '2026-08-01' })
  render(<ProfileGate><p>Existing household</p></ProfileGate>)
  expect(await screen.findByText('Existing household')).toBeVisible()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})
it('a profile network failure never starts fresh onboarding', async () => {
  profile.mockRejectedValue(new Error('Network unavailable'))
  render(<ProfileGate><p>Existing household</p></ProfileGate>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
})

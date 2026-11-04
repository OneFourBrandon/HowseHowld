import type { ChoreClaim, Infraction } from '../types'

/** A live claim keeps the review open until the claim vote decides it. */
export function isInfractionReviewOpen(
  infraction: Infraction,
  now = Date.now(),
  claim?: Pick<ChoreClaim, 'status'>,
) {
  if (claim?.status === 'claimed' || claim?.status === 'submitted') return true
  if (claim?.status === 'approved' || claim?.status === 'rejected') return false
  return (infraction.status === 'pending' || infraction.status === 'disputed')
    && new Date(infraction.disputeDeadline).getTime() > now
}

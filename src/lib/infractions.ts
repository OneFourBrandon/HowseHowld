import type { Infraction } from '../types'

export function isInfractionReviewOpen(infraction: Infraction, now = Date.now()) {
  return (infraction.status === 'pending' || infraction.status === 'disputed')
    && new Date(infraction.disputeDeadline).getTime() > now
}

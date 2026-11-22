import {
  BadgeCheck,
  BellRing,
  Camera,
  CarFront,
  ChevronRight,
  ListChecks,
  ReceiptText,
  Scale,
  TriangleAlert,
  WalletMinimal,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AttentionItem } from '../lib/insights'
import { useAppData } from '../state/AppDataContext'
import { Tile } from './ui'

function AttentionIcon({ item }: { item: AttentionItem }) {
  const kind = item.id.split(':')[0]
  const size = 16
  if (kind === 'chore') return item.tone === 'brick' ? <TriangleAlert size={size} /> : <ListChecks size={size} />
  if (kind === 'blocking') return <CarFront size={size} />
  if (kind === 'claim-photo') return <Camera size={size} />
  if (kind === 'vote' || kind === 'claim-vote' || kind === 'my-miss') return <Scale size={size} />
  if (kind === 'settlement' || kind === 'fund') return <BadgeCheck size={size} />
  if (kind === 'bill-price') return <ReceiptText size={size} />
  if (kind === 'reminders-off') return <BellRing size={size} />
  return <WalletMinimal size={size} />
}

/** One thing waiting on the signed-in member, with its shortcut when it has one. */
export function AttentionRow({ item, onNavigate }: { item: AttentionItem; onNavigate?: () => void }) {
  const { busy, completeOccurrence, confirmSettlement, confirmFundPayment } = useAppData()
  const quick = item.quick
  const working = quick?.type === 'complete' ? busy === `complete:${quick.occurrenceId}`
    : quick?.type === 'confirm-settlement' ? busy === `settlement:${quick.settlementId}`
      : quick?.type === 'confirm-fund' ? busy === `fund:${quick.paymentId}` : false

  const runQuick = () => {
    if (!quick) return
    // The shared handler reports failures in the toast.
    const ignore = () => {}
    if (quick.type === 'complete') void completeOccurrence(quick.occurrenceId).catch(ignore)
    if (quick.type === 'confirm-settlement') void confirmSettlement(quick.settlementId, true).catch(ignore)
    if (quick.type === 'confirm-fund') void confirmFundPayment(quick.paymentId, true).catch(ignore)
  }

  return (
    <div className="sl-row grid-cols-[auto_minmax(0,1fr)_auto]">
      <Tile tone={item.tone}><AttentionIcon item={item} /></Tile>
      <Link className="min-w-0 rounded-sm" to={item.href} onClick={onNavigate}>
        <span className="sl-cell-main whitespace-normal">{item.title}</span>
        <span className="sl-cell-sub whitespace-normal">{item.detail}</span>
      </Link>
      {quick ? (
        <button
          type="button"
          className="sl-btn sl-btn-secondary sl-btn-sm"
          aria-label={`${quick.label}: ${item.title}`}
          disabled={working}
          onClick={runQuick}
        >
          {quick.label}
        </button>
      ) : (
        <Link className="sl-icon-btn" to={item.href} onClick={onNavigate} aria-label={`Open ${item.title}`}>
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  )
}

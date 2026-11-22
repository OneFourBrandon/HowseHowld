import { useMemo } from 'react'
import { attentionCounts, attentionItems, moneyByMember, todayKey } from '../lib/insights'
import { useAppData } from '../state/AppDataContext'
import { useNow } from './hooks'

/** The signed-in member's view of the house: who they are, what they owe, what is waiting on them. */
export function useHouse() {
  const { data, demoMode } = useAppData()
  const now = useNow()
  const money = useMemo(() => moneyByMember(data, demoMode, now), [data, demoMode, now])
  const balances = useMemo(
    () => new Map([...money].map(([memberId, row]) => [memberId, row.netCents])),
    [money],
  )
  const attention = useMemo(() => attentionItems(data, now, balances), [balances, data, now])
  const counts = useMemo(() => attentionCounts(attention), [attention])
  const me = data.members.find(member => member.id === data.household.currentMemberId) ?? data.members[0]
  return {
    now,
    today: todayKey(data, now),
    me,
    isOwner: me?.role === 'owner',
    money,
    balances,
    attention,
    counts,
    actionCount: attention.filter(item => item.level === 'action').length,
  }
}

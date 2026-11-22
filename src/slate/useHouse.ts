import { createContext, useContext, useMemo } from 'react'
import { attentionCounts, attentionItems, moneyByMember, todayKey } from '../lib/insights'
import { useAppData } from '../state/AppDataContext'
import { useNow } from './hooks'

/** The signed-in member's view of the house: who they are, what they owe, what is waiting on them. */
export function useHouseValue() {
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
  const today = todayKey(data, now)
  return useMemo(() => ({
    now,
    today,
    me,
    isOwner: me?.role === 'owner',
    money,
    balances,
    attention,
    counts,
    actionCount: attention.filter(item => item.level === 'action').length,
  }), [attention, balances, counts, me, money, now, today])
}

export type House = ReturnType<typeof useHouseValue>

/**
 * The shell works this out once and shares it, so the badges in the
 * navigation and the lists on the page always agree.
 */
export const HouseContext = createContext<House | null>(null)

export function useHouse(): House {
  const house = useContext(HouseContext)
  if (!house) throw new Error('useHouse must be used inside the slate shell.')
  return house
}

import type { AgendaKind } from '../lib/insights'
import type { Tone } from './tone'

export const kindTone: Record<AgendaKind, Tone> = {
  chore: 'moss',
  bill: 'brass',
  event: 'steel',
  class: 'iris',
  exam: 'iris',
  exit: 'ink',
}

export const kindLabel: Record<AgendaKind, [singular: string, plural: string]> = {
  chore: ['chore', 'chores'],
  bill: ['bill', 'bills'],
  event: ['event', 'events'],
  class: ['class', 'classes'],
  exam: ['exam', 'exams'],
  exit: ['driveway exit', 'driveway exits'],
}

/**
 * An axis maximum at or above `peak` that splits into `intervals` tidy steps
 * of 1, 2, 2.5 or 5 times a power of ten.
 */
export function axisMax(peak: number, intervals = 4) {
  if (peak <= 0) return intervals
  const rough = peak / intervals
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= rough) ?? rough
  return step * intervals
}

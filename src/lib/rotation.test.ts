import { expect, it } from 'vitest'
import { randomRotationStart } from './rotation'

it('can start on every roommate while preserving cyclic order and input', () => {
  const members = ['a', 'b', 'c']
  expect(randomRotationStart(members, () => 0)).toEqual(['a', 'b', 'c'])
  expect(randomRotationStart(members, () => 0.5)).toEqual(['b', 'c', 'a'])
  expect(randomRotationStart(members, () => 0.99)).toEqual(['c', 'a', 'b'])
  expect(members).toEqual(['a', 'b', 'c'])
  expect(randomRotationStart([])).toEqual([])
  expect(randomRotationStart(['a'])).toEqual(['a'])
})

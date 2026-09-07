import { describe, expect, it } from 'vitest'
import { blockerIds } from './utils'

describe('driveway columns', () => {
  const cars = ['a', 'b', 'c', 'd', 'e', 'f']
  it('only includes cars ahead in the same column', () => {
    expect(blockerIds(cars, 'f', 2)).toEqual(['b', 'd'])
    expect(blockerIds(cars, 'e', 2)).toEqual(['a', 'c'])
    expect(blockerIds(cars, 'b', 2)).toEqual([])
  })
  it('retains a single-file driveway and ignores missing cars', () => {
    expect(blockerIds(cars, 'c')).toEqual(['a', 'b'])
    expect(blockerIds(cars, 'missing', 3)).toEqual([])
  })
})

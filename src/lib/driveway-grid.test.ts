import { describe, expect, it } from 'vitest'
import { assignVehicle, blockingVehicles, nextSlotPosition, validSlot } from './driveway'
import type { DrivewaySlot } from '../types'

const slot = (id: string, x: number, y: number, width = 1, height = 1): DrivewaySlot => ({ id, x, y, width, height, kind: 'driveway', vehicleId: id })
describe('editable parking slots', () => {
  it('includes all slots above overlapping parts of a wide car, not adjacent cars', () => {
    const slots = [slot('left',0,0),slot('right',1,0),slot('side',2,1),slot('long',0,1,1,2),slot('target',0,4,2,2),slot('behind',0,6)]
    expect(blockingVehicles(slots,'target')).toEqual(['left','right','long'])
    expect(blockingVehicles(slots,'left')).toEqual([])
    expect(blockingVehicles(slots,'unparked')).toEqual([])
  })
  it('fills holes and respects stretched footprints', () => {
    const slots = [slot('a',0,0,2,2),slot('b',0,2)]
    expect(nextSlotPosition(slots)).toEqual({x:1,y:2})
    expect(validSlot(slot('c',1,1), slots)).toBe(false)
    expect(validSlot(slot('c',2,0,10,20), slots)).toBe(true)
  })
  it('swaps parked vehicles, unparks without deleting the slot, rejects occupied destinations', () => {
    const slots = [slot('a',0,0),slot('b',0,1)]
    const swapped = assignVehicle(slots,'a','b')
    expect(swapped.map(s => s.vehicleId)).toEqual(['b','a'])
    expect(assignVehicle(swapped,'a',null).map(s => s.vehicleId)).toEqual(['b',undefined])
    expect(() => assignVehicle(slots,'new','a')).toThrow('occupied')
    expect(() => assignVehicle(slots,'a','missing')).toThrow('no longer exists')
  })
})

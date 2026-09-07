import type { AppSnapshot, DrivewaySlot } from '../types'

export function overlaps(a: DrivewaySlot, b: DrivewaySlot) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

export function validSlot(slot: DrivewaySlot, slots: DrivewaySlot[]) {
  return [slot.x, slot.y, slot.width, slot.height].every(Number.isSafeInteger) &&
    slot.x >= 0 && slot.y >= 0 && slot.width >= 1 && slot.height >= 1 &&
    !slots.some(other => other.id !== slot.id && overlaps(slot, other))
}

export function nextSlotPosition(slots: DrivewaySlot[]) {
  const columns = Math.max(1, ...slots.map(slot => slot.x + slot.width))
  for (let y = 0; ; y++) {
    for (let x = 0; x < columns; x++) {
      if (!slots.some(slot => x >= slot.x && x < slot.x + slot.width && y >= slot.y && y < slot.y + slot.height)) return { x, y }
    }
  }
}

export function blockingVehicles(slots: DrivewaySlot[], vehicleId: string) {
  const target = slots.find(slot => slot.vehicleId === vehicleId)
  if (!target) return []
  return slots.filter(slot => slot.vehicleId && slot.y + slot.height <= target.y &&
    slot.x < target.x + target.width && target.x < slot.x + slot.width)
    .sort((a, b) => a.y - b.y || a.x - b.x).map(slot => slot.vehicleId!)
}

// Seed the demo and upgrade existing linear layouts without losing parked cars.
export function slotsFor(data: Pick<AppSnapshot, 'drivewaySlots' | 'vehicles' | 'household'>): DrivewaySlot[] {
  if (data.drivewaySlots) return data.drivewaySlots
  const width = data.household.drivewayWidth ?? 1
  const outdoorRows = Math.max(1, Math.ceil(data.vehicles.length / width) - (data.household.garageRows ?? 0))
  return data.vehicles.map((vehicle, index) => ({
    id: vehicle.id, vehicleId: vehicle.id, x: index % width, y: Math.floor(index / width), width: 1, height: 1,
    kind: Math.floor(index / width) >= outdoorRows ? 'garage' : 'driveway',
  }))
}

export function assignVehicle(slots: DrivewaySlot[], vehicleId: string, slotId: string | null) {
  const target = slots.find(slot => slot.id === slotId)
  if (slotId && !target) throw new Error('That parking slot no longer exists.')
  const source = slots.find(slot => slot.vehicleId === vehicleId)
  if (source?.id === slotId) return slots
  if (target?.vehicleId && !source) throw new Error('That slot is occupied. Choose an empty slot.')
  return slots.map(slot => slot.id === slotId ? { ...slot, vehicleId } : slot.vehicleId === vehicleId ? { ...slot, vehicleId: target?.vehicleId } : slot)
}

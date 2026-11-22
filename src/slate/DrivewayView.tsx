import { CarFront, Clock3, LogOut } from 'lucide-react'
import { DrivewayBoard } from '../components/DrivewayBoard'
import { listNames } from '../lib/chores'
import { blockingVehicles, slotsFor } from '../lib/driveway'
import { formatDateTime, timeUntil } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import { readableOn } from './color'
import { Chip, Empty, Face, Panel, Stat, Stats } from './ui'
import { useHouse } from './useHouse'

/** The slate layout for Driveway. The board itself and the dialogs are shared with the classic page. */
export function DrivewayView({
  onManageVehicles,
  onQuickRemove,
  onScheduleExit,
}: {
  onManageVehicles: () => void
  onQuickRemove: () => void
  onScheduleExit: () => void
}) {
  const { data } = useAppData()
  const { now, me } = useHouse()
  const slots = slotsFor(data)
  const memberById = (id?: string) => data.members.find(member => member.id === id)
  const vehicleById = (id?: string) => data.vehicles.find(vehicle => vehicle.id === id)
  const parkedCount = slots.filter(slot => slot.vehicleId).length
  const exits = [...data.departures]
    .filter(departure => vehicleById(departure.vehicleId) && memberById(departure.ownerMemberId))
    .filter(departure => new Date(departure.requiredAt).getTime() >= now)
    .sort((left, right) => left.requiredAt.localeCompare(right.requiredAt))
  const nextExit = exits[0]
  const blockedExits = exits.filter(departure => blockingVehicles(slots, departure.vehicleId).length > 0).length
  const myVehicles = data.vehicles.filter(vehicle => vehicle.ownerMemberId === me.id)
  const myParked = myVehicles.find(vehicle => slots.some(slot => slot.vehicleId === vehicle.id))
  const myBlockers = myParked ? blockingVehicles(slots, myParked.id) : []
  const noVehicles = data.vehicles.length === 0

  return (
    <>
      <div className="sl-toolbar">
        <p className="text-(--sl-ink-2)">
          {noVehicles ? 'Add the cars that park here to get started.'
            : `${parkedCount} of ${slots.length} ${slots.length === 1 ? 'slot' : 'slots'} taken. The street is at the top of the board.`}
        </p>
        <div className="sl-toolbar-group">
          <button type="button" className="sl-btn sl-btn-secondary" onClick={onManageVehicles}>
            <CarFront size={15} /> Manage vehicles
          </button>
          <button type="button" className="sl-btn sl-btn-secondary" disabled={noVehicles} onClick={onQuickRemove}>
            <LogOut size={15} /> Quick remove
          </button>
          <button type="button" className="sl-btn sl-btn-primary" disabled={noVehicles} onClick={onScheduleExit}>
            <Clock3 size={15} /> Schedule exit
          </button>
        </div>
      </div>

      <div className="sl-grid">
        <Panel className="col-span-12" aria-label="Driveway at a glance">
          <Stats cols={4} colsSm={2}>
            <Stat tone="ink" label="Slots taken" value={<>{parkedCount}<span className="text-(--sl-muted)"> of {slots.length}</span></>} />
            <Stat
              tone="steel"
              label="Next exit"
              value={nextExit ? timeUntil(nextExit.requiredAt).replace(/^in /, '') : 'None'}
              note={nextExit ? `${vehicleById(nextExit.vehicleId)?.label}, ${memberById(nextExit.ownerMemberId)?.displayName}` : 'Nothing scheduled'}
            />
            <Stat tone={blockedExits ? 'brass' : 'moss'} label="Exits with cars in the way" value={blockedExits} />
            <Stat
              tone={myBlockers.length ? 'brass' : 'moss'}
              label="Your way out"
              value={!myVehicles.length ? 'No car' : !myParked ? 'Not parked' : myBlockers.length ? `${myBlockers.length} in the way` : 'Clear'}
              note={myParked?.label}
            />
          </Stats>
        </Panel>

        <Panel className="sl-embed col-span-12 lg:col-span-8">
          <DrivewayBoard />
        </Panel>

        <div className="col-span-12 grid content-start gap-px lg:col-span-4 lg:grid-rows-[auto_1fr]">
          <Panel flush title="Upcoming exits" note="Cars parked in the way are warned ahead of time.">
            <div className="sl-rows mt-3 border-t border-(--sl-line)">
              {exits.map(departure => {
                const vehicle = vehicleById(departure.vehicleId)!
                const owner = memberById(departure.ownerMemberId)!
                const parked = slots.some(slot => slot.vehicleId === vehicle.id)
                const blockers = blockingVehicles(slots, vehicle.id)
                  .map(id => vehicleById(id))
                  .filter((item): item is NonNullable<typeof item> => Boolean(item))
                return (
                  <article key={departure.id} className="grid gap-2.5 px-(--sl-pad) py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Face member={owner} size={28} />
                      <div className="min-w-0 flex-1">
                        <span className="sl-cell-main">{vehicle.label}</span>
                        <span className="sl-cell-sub">{owner.id === me.id ? 'You' : owner.displayName}{departure.sourceLabel ? `, ${departure.sourceLabel}` : ''}</span>
                      </div>
                      <Chip tone="steel">{timeUntil(departure.requiredAt)}</Chip>
                    </div>
                    <p className="sl-meta">
                      <span className="sl-strong sl-num">{formatDateTime(departure.requiredAt)}</span>
                      <span className="mx-1.5 text-(--sl-faint)">/</span>
                      warning {departure.warningMinutes} min before
                    </p>
                    <p>
                      {!parked ? <Chip>Not parked in the driveway</Chip>
                        : !blockers.length ? <Chip tone="moss">Clear path to the street</Chip>
                          : (
                            <Chip tone="brass" className="h-auto! min-h-5 py-1 whitespace-normal!">
                              Has to move first: {listNames(blockers.map(blocker => {
                                const person = memberById(blocker.ownerMemberId)
                                return `${blocker.label}${person ? ` (${person.id === me.id ? 'you' : person.displayName})` : ''}`
                              }))}
                            </Chip>
                          )}
                    </p>
                  </article>
                )
              })}
            </div>
            {!exits.length && (
              <Empty title="No exits scheduled">
                Use Quick remove or Schedule exit when you need a clear path out.
              </Empty>
            )}
          </Panel>

          <Panel flush title="Vehicles" tools={<button type="button" className="sl-link" onClick={onManageVehicles}>Manage</button>}>
            <div className="sl-rows mt-3 border-t border-(--sl-line)">
              {data.vehicles.map(vehicle => {
                const owner = memberById(vehicle.ownerMemberId)
                const slotIndex = slots.findIndex(slot => slot.vehicleId === vehicle.id)
                const slot = slots[slotIndex]
                return (
                  <div className="sl-row grid-cols-[auto_minmax(0,1fr)_auto]" key={vehicle.id}>
                    <span className="sl-tile" style={{ background: vehicle.color, color: readableOn(vehicle.color) }} aria-hidden="true"><CarFront size={16} /></span>
                    <div className="min-w-0">
                      <span className="sl-cell-main">{vehicle.label}</span>
                      <span className="sl-cell-sub">
                        {[vehicle.plate, owner ? (owner.id === me.id ? 'Yours' : owner.displayName) : undefined].filter(Boolean).join(', ')}
                      </span>
                    </div>
                    {slot ? <Chip>{slot.kind === 'garage' ? 'Garage' : 'Slot'} {slotIndex + 1}</Chip> : <Chip tone="steel">Out</Chip>}
                  </div>
                )
              })}
            </div>
            {noVehicles && (
              <Empty title="No vehicles yet">
                <button type="button" className="sl-btn sl-btn-secondary sl-btn-sm mt-2" onClick={onManageVehicles}>Add a vehicle</button>
              </Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

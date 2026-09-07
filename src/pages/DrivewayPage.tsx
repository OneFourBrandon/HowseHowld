import { cn } from '../lib/cn'
import { useRef, useState } from 'react'
import {
  BellRing,
  CarFront,
  Clock3,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Badge, Button, Modal } from '../components/ui'
import { DrivewayBoard } from '../components/DrivewayBoard'
import { blockingVehicles, slotsFor } from '../lib/driveway'
import { formatDateTime, timeUntil, toIso } from '../lib/utils'
import type { Vehicle } from '../types'

export function DrivewayPage() {
  const { data, addDeparture, saveVehicle, removeVehicle } = useAppData()
  const slots = slotsFor(data)
  const [departureModal, setDepartureModal] = useState(false)
  const [vehicleModal, setVehicleModal] = useState(false)
  const [vehicleEditorOpen, setVehicleEditorOpen] = useState(false)
  const [vehicleId, setVehicleId] = useState(data.vehicles[0]?.id ?? '')
  const [requiredAt, setRequiredAt] = useState('')
  const [label, setLabel] = useState('')
  const [reasonChoice, setReasonChoice] = useState('')
  const [warningMinutes, setWarningMinutes] = useState(60)
  const [repeat, setRepeat] = useState<'once' | 'daily' | 'weekly'>('once')
  const [departureQuickMode, setDepartureQuickMode] = useState(false)
  const [quickDepartureMinutes, setQuickDepartureMinutes] = useState<number | null>(null)
  const [editingVehicleId, setEditingVehicleId] = useState('')
  const [vehicleLabel, setVehicleLabel] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleColor, setVehicleColor] = useState('#3e6d2d')
  const [vehicleSubmitting, setVehicleSubmitting] = useState(false)
  const vehicleSubmitLock = useRef(false)
  const openDeparture = (quick: boolean) => {
    setDepartureQuickMode(quick)
    setVehicleId((current) => current || data.vehicles[0]?.id || '')
    setRequiredAt(quick ? toLocalDateTimeValue(new Date(Date.now() + 60 * 60_000)) : '')
    setQuickDepartureMinutes(quick ? 60 : null)
    setLabel('')
    setReasonChoice('')
    setDepartureModal(true)
  }

  const resetVehicleEditor = () => {
    setVehicleEditorOpen(false)
    setEditingVehicleId('')
    setVehicleLabel('')
    setVehiclePlate('')
    setVehicleColor('#3e6d2d')
  }

  const openVehicleEditor = (vehicle?: Vehicle) => {
    setEditingVehicleId(vehicle?.id ?? '')
    setVehicleLabel(vehicle?.label ?? '')
    setVehiclePlate(vehicle?.plate ?? '')
    setVehicleColor(vehicle?.color ?? '#3e6d2d')
    setVehicleEditorOpen(true)
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl!">Driveway</h1><p className="mt-1 text-sm text-(--muted)">A place for every car, with a clear path out.</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button size="sm" variant="secondary" onClick={() => { resetVehicleEditor(); setVehicleModal(true) }}><CarFront size={16} /> Manage vehicles</Button>
          <Button size="sm" variant="secondary" disabled={!data.vehicles.length} onClick={() => openDeparture(true)}><LogOut size={16} /> Quick remove</Button>
          <Button size="sm" disabled={!data.vehicles.length} onClick={() => openDeparture(false)}><Clock3 size={16} /> Schedule exit</Button>
        </div>
      </header>

      <div className="grid gap-6">
        <DrivewayBoard />
        <section className="rounded-2xl border border-(--line) bg-(--surface-strong) p-4 sm:p-5">
          <h2 className="mb-4 text-xl!">Upcoming exits</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.departures.map(departure => {
              const vehicle = data.vehicles.find(car => car.id === departure.vehicleId)
              const owner = data.members.find(member => member.id === departure.ownerMemberId)
              if (!vehicle || !owner) return null
              const parked = slots.some(slot => slot.vehicleId === vehicle.id)
              const blockers = blockingVehicles(slots, vehicle.id).map(id => data.vehicles.find(car => car.id === id)!).filter(Boolean)
              return <article key={departure.id} className="rounded-xl border border-(--line) bg-(--paper) p-4">
                <div className="flex items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{vehicle.label}</strong><span className="text-xs text-(--muted)">{owner.displayName}</span></div><Badge tone="blue">{timeUntil(departure.requiredAt)}</Badge></div>
                <p className="mt-3 flex items-center gap-2 text-sm"><Clock3 size={15} className="shrink-0 text-(--muted)" />{formatDateTime(departure.requiredAt)}</p>
                <p className="mt-1 text-xs text-(--muted)">Notify {departure.warningMinutes} minutes before{departure.sourceLabel ? ' · ' + departure.sourceLabel : ''}</p>
                <div className="mt-3 grid gap-2 border-t border-(--line) pt-3">
                  {!parked ? <span className="text-xs text-(--muted)">Not parked in the driveway.</span> : !blockers.length ? <span className="text-xs text-(--green)">Clear path to the street.</span> : blockers.map(blocker => {
                    const person = data.members.find(member => member.id === blocker.ownerMemberId)
                    return <div className="flex items-center gap-2 text-xs" key={blocker.id}><BellRing size={14} className="shrink-0 text-(--gold)" /><span>{person?.displayName} · {blocker.label}</span></div>
                  })}
                </div>
              </article>
            })}
          </div>
          {!data.departures.length && <p className="py-4 text-center text-sm text-(--muted)">No exits scheduled. Choose Quick remove or Schedule exit when you need a clear path.</p>}
        </section>
      </div>

      <Modal
        open={departureModal}
        onClose={() => setDepartureModal(false)}
        title={departureQuickMode ? 'Quick remove vehicle' : 'Schedule exit'}
        description="Cars above your slot will be notified at the warning time you choose."
      >
        <form
          className={"form-grid grid grid-cols-2 gap-3.75 max-[640px]:grid-cols-1"}
          onSubmit={async (event) => {
            event.preventDefault()
            if (!vehicleId || !requiredAt) return
            const reasonNote = label.trim()
            const departureReason = reasonChoice && reasonChoice !== 'other'
              ? reasonNote ? `${reasonChoice}: ${reasonNote}` : reasonChoice
              : reasonNote
            await addDeparture(
              vehicleId,
              toIso(new Date(requiredAt)),
              departureReason || 'Manual departure',
              warningMinutes,
              repeat === 'once' ? undefined : { frequency: repeat, interval: 1 },
            )
            setDepartureModal(false)
            setLabel('')
            setReasonChoice('')
            setRequiredAt('')
          }}
        >
          <label className={"field-span-2 col-span-full max-[640px]:col-[1]"}>Vehicle
            <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {data.vehicles.map((vehicle) => (
                <option value={vehicle.id} key={vehicle.id}>{vehicle.label}</option>
              ))}
            </select>
          </label>
          {departureQuickMode && (
            <fieldset className="field-span-2 col-span-full grid gap-2.5 border-0 p-0 max-[640px]:col-[1]">
              <legend className="text-[.78rem] font-extrabold text-(--ink)">When should it be out?</legend>
              <div className="grid gap-1.5">
                <input
                  className="m-0 w-full accent-(--forest)"
                  type="range"
                  min="30"
                  max="360"
                  step="30"
                  value={quickDepartureMinutes ?? 60}
                  aria-label="Minutes until vehicle exit"
                  onChange={(event) => {
                    const minutes = Number(event.target.value)
                    setQuickDepartureMinutes(minutes)
                    setRequiredAt(toLocalDateTimeValue(new Date(Date.now() + minutes * 60_000)))
                  }}
                />
                <div className="flex justify-between px-1" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <span className={cn('h-1.5 w-1.5 rounded-full bg-(--line-strong)', index === Math.round(((quickDepartureMinutes ?? 60) - 30) / 30) && 'bg-(--forest)!')} key={index} />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[.7rem] text-(--muted)">
                  <span>30 min</span>
                  <strong className="text-(--forest)">{formatQuickOffset(quickDepartureMinutes ?? 60)}</strong>
                  <span>6 hours</span>
                </div>
              </div>
            </fieldset>
          )}
          {departureQuickMode ? (
            <div className="grid content-center gap-1 rounded-lg border border-(--line) bg-(--sage-2) p-3">
              <span className="text-[.7rem] font-extrabold uppercase tracking-[.06em] text-(--muted)">Scheduled for</span>
              <strong className="text-[.86rem]">{requiredAt ? formatDateTime(toIso(new Date(requiredAt))) : 'Choose a quick time'}</strong>
            </div>
          ) : (
            <label>Needs out at
              <input type="datetime-local" value={requiredAt} onChange={(event) => setRequiredAt(event.target.value)} required />
            </label>
          )}
          <label>Common reason (optional)
            <select value={reasonChoice} onChange={(event) => setReasonChoice(event.target.value)}>
              <option value="">No reason selected</option>
              <option value="Class">Class</option>
              <option value="Work">Work</option>
              <option value="Appointment">Appointment</option>
              <option value="Errand">Errand</option>
              <option value="Guest pickup">Guest pickup</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Reason note (optional)
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Class, work, appointment…" />
          </label>
          <label>Warning
            <select value={warningMinutes} onChange={(event) => setWarningMinutes(Number(event.target.value))}>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
            </select>
          </label>
          <label>Repeat
            <select value={repeat} onChange={(event) => setRepeat(event.target.value as typeof repeat)}>
              <option value="once">One time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <div className={"modal-actions flex justify-end gap-2.25 mt-1.5 field-span-2 col-span-full max-[640px]:col-[1]"}>
            <Button type="button" variant="ghost" onClick={() => setDepartureModal(false)}>Cancel</Button>
            <Button type="submit">{departureQuickMode ? 'Schedule quick exit' : 'Schedule exit'}</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={vehicleModal}
        onClose={() => {
          setVehicleModal(false)
          resetVehicleEditor()
        }}
        title="Manage vehicles"
        description="Add a vehicle or update the vehicles you own."
      >
        <div className="grid gap-5">
          <div className="divide-y divide-(--line) border-y border-(--line)">
            {data.vehicles.length ? data.vehicles.map((vehicle) => {
              const owner = data.members.find((member) => member.id === vehicle.ownerMemberId)!
              const canManage = vehicle.ownerMemberId === data.household.currentMemberId
              return (
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5" key={vehicle.id}>
                  <div className="grid h-10 w-12 place-items-center rounded-lg text-white" style={{ backgroundColor: vehicle.color }}>
                    <CarFront size={20} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-[.9rem]">{vehicle.label}</strong>
                    <span className="block truncate text-[.75rem] text-(--muted)">
                      {[vehicle.plate, owner.displayName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-(--line) bg-transparent text-(--muted) transition-colors hover:bg-(--sage-2) hover:text-(--forest)" type="button" onClick={() => openVehicleEditor(vehicle)} aria-label={`Edit ${vehicle.label}`}>
                        <Pencil size={16} />
                      </button>
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-(--line) bg-transparent text-(--muted) transition-colors hover:border-[#d9aaa3] hover:bg-[#fff1ef] dark:bg-(--coral-soft) hover:text-[#a34135] dark:text-(--coral)" type="button" onClick={() => {
                        if (window.confirm(`Delete ${vehicle.label}?`)) void removeVehicle(vehicle.id)
                      }} aria-label={`Delete ${vehicle.label}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )
            }) : (
              <p className="py-5 text-[.82rem] text-(--muted)">No vehicles have been added yet.</p>
            )}
          </div>
          {!vehicleEditorOpen ? (
            <Button type="button" onClick={() => openVehicleEditor()}>
              <Plus size={17} /> Add vehicle
            </Button>
          ) : (
            <form
              className="form-grid grid grid-cols-2 gap-3.75 border-t border-(--line) pt-5 max-[640px]:grid-cols-1"
              onSubmit={async (event) => {
                event.preventDefault()
                if (!vehicleLabel.trim() || vehicleSubmitLock.current) return
                vehicleSubmitLock.current = true
                setVehicleSubmitting(true)
                try {
                  await saveVehicle({
                    id: editingVehicleId || undefined,
                    label: vehicleLabel.trim(),
                    plate: vehiclePlate.trim() || undefined,
                    color: vehicleColor,
                  })
                  resetVehicleEditor()
                } finally {
                  vehicleSubmitLock.current = false
                  setVehicleSubmitting(false)
                }
              }}
            >
              <div className="col-span-full">
                <strong className="text-[.92rem]">{editingVehicleId ? 'Edit vehicle' : 'Add a vehicle'}</strong>
              </div>
              <label>Vehicle name
                <input value={vehicleLabel} onChange={(event) => setVehicleLabel(event.target.value)} placeholder="Blue Civic" required />
              </label>
              <label>Plate
                <input value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value)} placeholder="ABC 123" />
              </label>
              <label>Color
                <input type="color" value={vehicleColor} onChange={(event) => setVehicleColor(event.target.value)} />
              </label>
              <div className="modal-actions col-span-full mt-1.5 flex justify-end gap-2.25 max-[640px]:col-[1]">
                <Button type="button" variant="ghost" onClick={resetVehicleEditor}>Cancel</Button>
                <Button type="submit" disabled={vehicleSubmitting}>{vehicleSubmitting ? 'Saving…' : editingVehicleId ? 'Save changes' : 'Add vehicle'}</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  )
}

function toLocalDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatQuickOffset(minutes: number) {
  if (minutes < 60) return `Next ${minutes} minutes`
  if (minutes === 60) return 'Next hour'
  const hours = minutes / 60
  return `In ${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`
}

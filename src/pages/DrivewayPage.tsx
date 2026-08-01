import { cn } from '../lib/cn'
import { useRef, useState } from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  BellRing,
  CarFront,
  Clock3,
  GripVertical,
  LogOut,
  Pencil,
  Plus,
  Route,
  Trash2,
} from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, Modal, SectionHeader } from '../components/ui'
import { formatDateTime, timeUntil, toIso } from '../lib/utils'
import type { Vehicle } from '../types'

export function DrivewayPage() {
  const { data, busy, reorderVehicles, addDeparture, saveVehicle, removeVehicle } = useAppData()
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = data.vehicles.findIndex((item) => item.id === active.id)
    const newIndex = data.vehicles.findIndex((item) => item.id === over.id)
    const ordered = arrayMove(data.vehicles, oldIndex, newIndex).map((item) => item.id)
    await reorderVehicles(ordered)
  }

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
    <div className={"page-stack grid gap-14.5 max-[980px]:gap-13 max-[640px]:gap-11.5"}>
      <header className="page-header flex items-end justify-between gap-10 border-b border-b-(--line-strong) pb-7.5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-5.5 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>NO MORE DRIVEWAY TEXT CHAINS</p>
          <h1 className="text-[clamp(3.15rem,4.5vw,4.8rem)] max-[640px]:text-[clamp(2.55rem,13vw,3.35rem)]">Driveway</h1>
          <p>The current lineup decides exactly who needs to move.</p>
        </div>
        <div className="button-row flex flex-wrap items-center gap-2.25 max-[640px]:w-full">
          <Button className="max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:px-2.5 max-[640px]:text-[.72rem]" variant="secondary" onClick={() => {
            resetVehicleEditor()
            setVehicleModal(true)
          }}>
            <CarFront size={18} /> Manage vehicles
          </Button>
          <Button className="max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:px-2.5 max-[640px]:text-[.72rem]" variant="secondary" disabled={!data.vehicles.length} onClick={() => openDeparture(true)}>
            <LogOut size={18} /> Quick remove vehicle
          </Button>
          <Button className="max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:px-2.5 max-[640px]:text-[.72rem]" disabled={!data.vehicles.length} onClick={() => openDeparture(false)}>
            <Plus size={18} /> Schedule exit
          </Button>
        </div>
      </header>

      <div className={"driveway-layout grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.65fr)] items-start max-[980px]:grid-cols-1 gap-14.5 max-[980px]:gap-12.5"}>
        <section>
          <SectionHeader
            eyebrow="LIVE LINEUP"
            title="Street to back"
            description={`Version ${data.drivewayVersion} · drag cars to update`}
          />
          <Card className={"driveway-card relative overflow-hidden p-[22px_0_26px] py-[28px_34px]"}>
            <div className="street-label flex items-center justify-center gap-3 text-[.75rem] font-extrabold tracking-[.07em] text-(--muted)">
              <span className="h-0.25 flex-1 bg-(--line)" />
              STREET / EXIT
              <span className="h-0.25 flex-1 bg-(--line)" />
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={dragEnd}
            >
              <SortableContext
                items={data.vehicles.map((vehicle) => vehicle.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={"driveway-lane w-full m-[18px_auto] p-[12px_17px] border-2  rounded-[10px] border-[#bfc9c2] bg-[#eef1ed]"}>
                  {data.vehicles.map((vehicle, index) => (
                    <SortableVehicle
                      key={vehicle.id}
                      vehicle={vehicle}
                      index={index}
                      owner={data.members.find((member) => member.id === vehicle.ownerMemberId)!}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className={"back-label flex items-center justify-center gap-3 font-extrabold text-[#919890] text-[.75rem] tracking-[.07em]"}><ArrowDown size={16} /> BACK OF DRIVEWAY</div>
            {busy === 'driveway:reorder' && <div className={"driveway-saving absolute inset-[auto_16px_12px_auto] text-(--muted) text-[.75rem]"}>Updating lineup…</div>}
          </Card>
        </section>

        <section>
          <SectionHeader eyebrow="DEPARTURES" title="Who needs out" />
          <div className={"departure-list grid gap-0"}>
            {data.departures.map((departure) => {
              const vehicle = data.vehicles.find((item) => item.id === departure.vehicleId)!
              const owner = data.members.find((item) => item.id === departure.ownerMemberId)!
              const blockers = departure.blockerVehicleIds
                .map((id) => data.vehicles.find((item) => item.id === id))
                .filter(Boolean)
              return (
                <Card className={"departure-card grid gap-3.5 p-[22px_4px] border-b border-b-(--line) max-[640px]:pl-0 max-[640px]:pr-0 py-6.75"} key={departure.id}>
                  <div className="departure-card-top grid grid-cols-[auto_1fr_auto] items-center gap-2.5">
                    <div className={"car-swatch w-10.5 h-8.75 grid place-items-center text-white rounded-[7px]"} style={{ background: vehicle.color }}>
                      <CarFront />
                    </div>
                    <div>
                      <strong className="block text-[.88rem]">{vehicle.label}</strong>
                      <span>{owner.displayName} · {departure.sourceLabel}</span>
                    </div>
                    <Badge tone="blue">{timeUntil(departure.requiredAt)}</Badge>
                  </div>
                  <div className="departure-time flex items-start gap-2.25 rounded-none border-y border-[#d3d9ed] bg-transparent py-3 font-sans text-[#4d6098] tabular-nums">
                    <Clock3 size={17} />
                    <div className="grid min-w-0 gap-1">
                      <strong className="block leading-tight">{formatDateTime(departure.requiredAt)}</strong>
                      <span className="block text-[.76rem] leading-snug text-[#6878a6]">Alert {departure.warningMinutes} minutes before</span>
                    </div>
                  </div>
                  <div className="blocker-box grid gap-2.25">
                    <div className="flex items-center gap-1.5 text-[.75rem] font-bold text-(--muted)"><Route size={17} /><span>{blockers.length} blocking car{blockers.length === 1 ? '' : 's'}</span></div>
                    {blockers.length ? (
                      blockers.map((blocker) => {
                        const blockerOwner = data.members.find((member) => member.id === blocker!.ownerMemberId)!
                        return (
                          <div className="blocker-person grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[.75rem]" key={blocker!.id}>
                            <Avatar initials={blockerOwner.initials} color={blockerOwner.color} imageUrl={blockerOwner.avatarUrl} size="sm" />
                            <span>{blockerOwner.displayName} moves {blocker!.label}</span>
                            <BellRing className="text-(--gold)" size={15} />
                          </div>
                        )
                      })
                    ) : (
                      <span className={"all-clear-text text-(--green) text-[.75rem]"}>Clear path to the street.</span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </div>

      <Modal
        open={departureModal}
        onClose={() => setDepartureModal(false)}
        title={departureQuickMode ? 'Quick remove vehicle' : 'Schedule exit'}
        description="The current blockers will be notified one hour beforehand."
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
                    <span className={cn('h-1.5 w-1.5 rounded-full bg-(--line-strong)', index === Math.round(((quickDepartureMinutes ?? 60) - 30) / 30) && 'bg-(--forest)')} key={index} />
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
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-(--line) bg-transparent text-(--muted) transition-colors hover:border-[#d9aaa3] hover:bg-[#fff1ef] hover:text-[#a34135]" type="button" onClick={() => {
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

function SortableVehicle({
  vehicle,
  owner,
  index,
}: {
  vehicle: Vehicle
  owner: ReturnType<typeof useAppData>['data']['members'][number]
  index: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: vehicle.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'vehicle-row grid min-h-19.5 cursor-grab touch-manipulation grid-cols-[auto_25px_auto_1fr_auto_60px] items-center gap-2.5 rounded-none border-b border-b-(--line) bg-transparent px-1.5 py-3.75 shadow-none active:cursor-grabbing max-[640px]:grid-cols-[auto_20px_auto_1fr_auto]',
        isDragging && 'is-dragging z-[5] bg-(--surface-strong) opacity-[.85] shadow-[0_12px_28px_rgba(30,48,40,.14)]',
      )}
      {...attributes}
      {...listeners}
    >
      <span className={"drag-handle p-0.75 text-[#9fa49f]"} aria-hidden="true">
        <GripVertical />
      </span>
      <span className={"position-number text-(--muted) font-extrabold text-center text-[.75rem]"}>{index + 1}</span>
      <div className={"vehicle-art w-10.5 h-8 grid place-items-center text-white rounded-[7px]"} style={{ background: vehicle.color }}>
        <CarFront />
      </div>
      <div className="vehicle-name">
        <strong className="block text-[.88rem]">{vehicle.label}</strong>
        <span className="mt-0.75 block text-[.75rem] tracking-[.02em] text-(--muted)">{vehicle.plate}</span>
      </div>
      <Avatar initials={owner.initials} color={owner.color} imageUrl={owner.avatarUrl} size="sm" />
      <span className={"owner-name text-(--muted) max-[640px]:hidden text-[.75rem]"}>{owner.displayName}</span>
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

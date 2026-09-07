import { cn } from '../lib/cn'
import { useEffect, useRef, useState } from 'react'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
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
import {
  Avatar,
  Button,
  Card,
  CardHead,
  EmptyState,
  FeatureCard,
  Modal,
  PageHeader,
  Pill,
} from '../components/ui'
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
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null)
  const [previewOrder, setPreviewOrder] = useState(() => data.vehicles.map((vehicle) => vehicle.id))
  const previewOrderRef = useRef(previewOrder)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 4 } }),
  )

  useEffect(() => {
    if (activeVehicleId) return
    const nextOrder = data.vehicles.map((vehicle) => vehicle.id)
    previewOrderRef.current = nextOrder
    setPreviewOrder(nextOrder)
  }, [activeVehicleId, data.vehicles])

  const previewVehicles = previewOrder
    .map((id) => data.vehicles.find((vehicle) => vehicle.id === id))
    .filter((vehicle): vehicle is Vehicle => Boolean(vehicle))

  const dragStart = ({ active }: DragStartEvent) => {
    const nextOrder = data.vehicles.map((vehicle) => vehicle.id)
    previewOrderRef.current = nextOrder
    setPreviewOrder(nextOrder)
    setActiveVehicleId(String(active.id))
  }

  const dragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return
    const currentOrder = previewOrderRef.current
    const oldIndex = currentOrder.indexOf(String(active.id))
    const newIndex = currentOrder.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex)
    previewOrderRef.current = nextOrder
    setPreviewOrder(nextOrder)
  }

  const dragEnd = async ({ over }: DragEndEvent) => {
    if (!over) {
      setActiveVehicleId(null)
      return
    }
    const ordered = previewOrderRef.current
    if (ordered.every((id, index) => id === data.vehicles[index]?.id)) {
      setActiveVehicleId(null)
      return
    }
    try {
      await reorderVehicles(ordered)
    } catch {
      // The shared mutation handler restores the latest lineup and shows the error.
    } finally {
      setActiveVehicleId(null)
    }
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
    <>
      <PageHeader
        title="Driveway"
        description="The current lineup decides exactly who needs to move."
        actions={
          <>
            <Button variant="secondary" onClick={() => {
              resetVehicleEditor()
              setVehicleModal(true)
            }}>
              <CarFront className="shrink-0" size={16} /> <span className="whitespace-nowrap">Manage vehicles</span>
            </Button>
            <Button variant="secondary" disabled={!data.vehicles.length} onClick={() => openDeparture(true)}>
              <LogOut className="shrink-0" size={16} />
              <span className="whitespace-nowrap">Quick remove</span>
            </Button>
            <Button disabled={!data.vehicles.length} onClick={() => openDeparture(false)}>
              <Plus className="shrink-0" size={16} /> <span className="whitespace-nowrap">Schedule exit</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(320px,.65fr)] items-start gap-5 max-[1100px]:grid-cols-1">
        <Card className="relative overflow-hidden pb-6">
          <CardHead
            title="Street to back"
            description="Drag cars to update the lineup. Everyone sees the same order."
            action={
              <Pill className="border-[rgba(61,220,151,.25)] bg-(--green-soft) text-(--green)">
                <Route size={13} /> Live
              </Pill>
            }
          />
          <div className="px-5 max-[640px]:px-3">
            <div className="flex items-center justify-center gap-3 text-[.68rem] font-extrabold tracking-[.14em] text-(--text-3)">
              <span className="h-px flex-1 bg-(--line-2)" />
              STREET / EXIT
              <span className="h-px flex-1 bg-(--line-2)" />
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={dragStart}
              onDragOver={dragOver}
              onDragEnd={dragEnd}
              onDragCancel={() => setActiveVehicleId(null)}
            >
              <SortableContext
                items={previewOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="hh-inner my-3.5 w-full p-1.5">
                  {previewVehicles.map((vehicle, index) => (
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
            <div className="flex items-center justify-center gap-2 text-[.68rem] font-extrabold tracking-[.14em] text-(--text-4)"><ArrowDown size={14} /> BACK OF DRIVEWAY</div>
            {!data.vehicles.length && (
              <EmptyState
                icon={CarFront}
                title="No vehicles yet"
                description="Add a car and the lineup shows who has to move."
                action={<Button size="sm" onClick={() => { resetVehicleEditor(); setVehicleModal(true) }}><Plus size={15} /> Add a vehicle</Button>}
              />
            )}
          </div>
          {busy === 'driveway:reorder' && <div className="absolute right-5 bottom-3 text-[.75rem] text-(--text-3)">Updating lineup…</div>}
        </Card>

        <div className="grid content-start gap-5">
            {data.departures.map((departure) => {
              const vehicle = data.vehicles.find((item) => item.id === departure.vehicleId)!
              const owner = data.members.find((item) => item.id === departure.ownerMemberId)!
              const blockers = departure.blockerVehicleIds
                .map((id) => data.vehicles.find((item) => item.id === id))
                .filter(Boolean)
              return (
                <FeatureCard tone="pink" className="grid gap-3.5 p-5" key={departure.id}>
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                    <div className="grid h-9 w-11 place-items-center rounded-xl text-white" style={{ background: vehicle.color }}>
                      <CarFront size={19} />
                    </div>
                    <div className="grid min-w-0 gap-0.5">
                      <strong className="truncate text-[.95rem]">{vehicle.label}</strong>
                      <span className="truncate text-[.78rem] text-[rgba(255,255,255,.8)]">{owner.displayName} · {departure.sourceLabel}</span>
                    </div>
                    <span className="hh-badge shrink-0 border-transparent bg-white text-(--bg)">{timeUntil(departure.requiredAt)}</span>
                  </div>
                  <div className="flex items-start gap-2.5 border-y border-[rgba(255,255,255,.22)] py-3">
                    <Clock3 size={17} className="mt-0.5 shrink-0" />
                    <div className="grid min-w-0 gap-0.5">
                      <strong className="block leading-tight tabular-nums">{formatDateTime(departure.requiredAt)}</strong>
                      <span className="block text-[.76rem] text-[rgba(255,255,255,.8)]">Alert {departure.warningMinutes} minutes before</span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-1.5 text-[.76rem] font-bold text-[rgba(255,255,255,.85)]"><Route size={15} /><span>{blockers.length} blocking car{blockers.length === 1 ? '' : 's'}</span></div>
                    {blockers.length ? (
                      blockers.map((blocker, blockerIndex) => {
                        const blockerOwner = data.members.find((member) => member.id === blocker!.ownerMemberId)!
                        return (
                          <div
                            className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-(--bg)"
                            style={{ marginLeft: blockerIndex * 14 }}
                            key={blocker!.id}
                          >
                            <Avatar initials={blockerOwner.initials} color={blockerOwner.color} imageUrl={blockerOwner.avatarUrl} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-[.8rem] font-bold">{blockerOwner.displayName} moves {blocker!.label}</span>
                            <BellRing size={15} className="shrink-0" />
                          </div>
                        )
                      })
                    ) : (
                      <span className="rounded-xl bg-white px-3 py-2.5 text-[.8rem] font-bold text-(--bg)">Clear path to the street.</span>
                    )}
                  </div>
                </FeatureCard>
              )
            })}
          {!data.departures.length && (
            <Card className="grid content-start gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2>Who needs out</h2>
                <Pill>Departures</Pill>
              </div>
              <EmptyState
                icon={LogOut}
                title="No exits scheduled"
                description="Schedule an exit and blockers get a reminder before it."
              />
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={departureModal}
        onClose={() => setDepartureModal(false)}
        title={departureQuickMode ? 'Quick remove vehicle' : 'Schedule exit'}
        description="The current blockers will be notified one hour beforehand."
      >
        <form
          className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1"
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
            <fieldset className="col-span-full grid gap-2.5 border-0 p-0 max-[640px]:col-[1]">
              <legend className="text-[.78rem] font-extrabold text-(--text)">When should it be out?</legend>
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
                <div className="flex items-center justify-between text-[.7rem] text-(--text-3)">
                  <span>30 min</span>
                  <strong className="text-(--text)">{formatQuickOffset(quickDepartureMinutes ?? 60)}</strong>
                  <span>6 hours</span>
                </div>
              </div>
            </fieldset>
          )}
          {departureQuickMode ? (
            <div className="grid content-center gap-1 rounded-lg border border-(--line) bg-(--inner) p-3">
              <span className="text-[.7rem] font-extrabold uppercase tracking-[.06em] text-(--text-3)">Scheduled for</span>
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
          <div className="col-span-full mt-1.5 flex justify-end gap-2 max-[640px]:col-[1]">
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
                    <span className="block truncate text-[.75rem] text-(--text-3)">
                      {[vehicle.plate, owner.displayName].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-(--line) bg-transparent text-(--text-3) transition-colors hover:bg-(--inner) hover:text-(--text)" type="button" onClick={() => openVehicleEditor(vehicle)} aria-label={`Edit ${vehicle.label}`}>
                        <Pencil size={16} />
                      </button>
                      <button className="grid h-9 w-9 place-items-center rounded-lg border border-(--line) bg-transparent text-(--text-3) transition-colors hover:border-[rgba(255,93,93,.4)] hover:bg-(--red-soft) hover:text-[#ff8080]" type="button" onClick={() => {
                        if (window.confirm(`Delete ${vehicle.label}?`)) void removeVehicle(vehicle.id)
                      }} aria-label={`Delete ${vehicle.label}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )
            }) : (
              <p className="py-5 text-[.82rem] text-(--text-3)">No vehicles have been added yet.</p>
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
              <div className="col-span-full mt-1.5 flex justify-end gap-2 max-[640px]:col-[1]">
                <Button type="button" variant="ghost" onClick={resetVehicleEditor}>Cancel</Button>
                <Button type="submit" disabled={vehicleSubmitting}>{vehicleSubmitting ? 'Saving…' : editingVehicleId ? 'Save changes' : 'Add vehicle'}</Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
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
        'grid min-h-16 cursor-grab touch-none grid-cols-[auto_22px_auto_1fr_auto_auto] items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-3 transition-colors select-none hover:bg-[rgba(255,255,255,.035)] active:cursor-grabbing max-[640px]:grid-cols-[auto_20px_auto_1fr_auto]',
        isDragging && 'z-5 bg-(--raise)! shadow-[0_16px_36px_-12px_rgba(0,0,0,.7)]',
      )}
      {...attributes}
      {...listeners}
    >
      <span className="p-0.5 text-(--text-4)" aria-hidden="true">
        <GripVertical />
      </span>
      <PositionNumber value={index + 1} />
      <div className="grid h-9 w-11 place-items-center rounded-xl text-white" style={{ background: vehicle.color }}>
        <CarFront />
      </div>
      <div className="min-w-0">
        <strong className="block text-[.88rem]">{vehicle.label}</strong>
        <span className="mt-0.75 block text-[.75rem] tracking-[.02em] text-(--text-3)">{vehicle.plate}</span>
      </div>
      <Avatar initials={owner.initials} color={owner.color} imageUrl={owner.avatarUrl} size="sm" />
      <span className="text-[.78rem] font-semibold text-(--text-3) max-[640px]:hidden">{owner.displayName}</span>
    </div>
  )
}

function PositionNumber({ value }: { value: number }) {
  const numberRef = useRef<HTMLSpanElement>(null)
  const previousValue = useRef(value)

  useEffect(() => {
    if (previousValue.current === value) return
    previousValue.current = value
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    numberRef.current?.animate(
      [
        { opacity: 0.45, transform: 'translateY(3px) scale(0.82)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
  }, [value])

  return (
    <span ref={numberRef} className="text-center text-[.78rem] font-extrabold text-(--text-3) tabular-nums">
      {value}
    </span>
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

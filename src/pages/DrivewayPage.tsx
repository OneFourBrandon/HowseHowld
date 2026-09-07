import { cn } from '../lib/cn'
import { Fragment, useEffect, useRef, useState } from 'react'
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
  rectSortingStrategy,
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
  const { data, busy, reorderVehicles, addDeparture, saveVehicle, removeVehicle, saveDrivewayLayout } = useAppData()
  const width = data.household.drivewayWidth ?? 1
  const [layoutWidth, setLayoutWidth] = useState(width)
  const [garageRows, setGarageRows] = useState(data.household.garageRows ?? 0)
  const isOwner = data.members.find(m => m.id === data.household.currentMemberId)?.role === 'owner'
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

  const savedGarageRows = data.household.garageRows ?? 0
  const outdoorRows = Math.max(1, Math.ceil(previewVehicles.length / width) - savedGarageRows)
  const garageStart = outdoorRows * width
  const slotCount = savedGarageRows ? garageStart + savedGarageRows * width : previewVehicles.length

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
    <div className={"page-stack grid gap-14.5 max-[980px]:gap-13 max-[640px]:gap-11.5"}>
      <header className="page-header flex items-end justify-between gap-10 border-b border-b-(--line-strong) pb-7.5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-5.5 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>NO MORE DRIVEWAY TEXT CHAINS</p>
          <h1 className="text-[clamp(3.15rem,4.5vw,4.8rem)] max-[640px]:text-[clamp(2.55rem,13vw,3.35rem)]">Driveway</h1>
          <p>The current lineup decides exactly who needs to move.</p>
        </div>
        <div className="button-row flex flex-wrap items-center gap-2.25 max-[640px]:grid max-[640px]:w-full max-[640px]:grid-cols-2 max-[640px]:gap-2">
          <Button className="max-[640px]:w-full max-[640px]:min-w-0 max-[640px]:px-3 max-[640px]:text-[.78rem]" variant="secondary" onClick={() => {
            resetVehicleEditor()
            setVehicleModal(true)
          }}>
            <CarFront className="shrink-0" size={18} /> <span className="whitespace-nowrap">Manage vehicles</span>
          </Button>
          <Button className="max-[640px]:w-full max-[640px]:min-w-0 max-[640px]:px-3 max-[640px]:text-[.78rem]" variant="secondary" disabled={!data.vehicles.length} onClick={() => openDeparture(true)}>
            <LogOut className="shrink-0" size={18} />
            <span className="whitespace-nowrap"><span className="max-[480px]:hidden">Quick remove vehicle</span><span className="hidden max-[480px]:inline">Quick remove</span></span>
          </Button>
          <Button className="max-[640px]:col-span-2 max-[640px]:w-full max-[640px]:min-w-0 max-[640px]:px-3 max-[640px]:text-[.8rem]" disabled={!data.vehicles.length} onClick={() => openDeparture(false)}>
            <Plus className="shrink-0" size={18} /> <span className="whitespace-nowrap">Schedule exit</span>
          </Button>
        </div>
      </header>

      <div className={"driveway-layout grid grid-cols-[minmax(0,1.45fr)_minmax(300px,.65fr)] items-start max-[980px]:grid-cols-1 gap-14.5 max-[980px]:gap-12.5"}>
        <section>
          <SectionHeader
            eyebrow="LIVE LINEUP"
            title="Street to back"
            description={`drag cars to update`}
          />
          {isOwner && <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={async e => { e.preventDefault(); try { await saveDrivewayLayout(layoutWidth, garageRows) } catch { /* shared error */ } }}>
            <label className="text-xs">Cars wide<select value={layoutWidth} onChange={e => setLayoutWidth(Number(e.target.value))}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="text-xs">Garage rows<select value={garageRows} onChange={e => setGarageRows(Number(e.target.value))}>{[0,1,2,3].map(n => <option key={n} value={n}>{n === 0 ? 'No garage' : n}</option>)}</select></label>
            <Button size="sm" disabled={busy === 'driveway:layout'}>Save layout</Button>
          </form>}
          <Card className={"driveway-card relative overflow-hidden p-[22px_0_26px] py-[28px_34px]"}>
            <div className="street-label flex items-center justify-center gap-3 text-[.75rem] font-extrabold tracking-[.07em] text-(--muted)">
              <span className="h-0.25 flex-1 bg-(--line)" />
              STREET / EXIT
              <span className="h-0.25 flex-1 bg-(--line)" />
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
                strategy={rectSortingStrategy}
              >
                <div className="my-4 overflow-x-auto"><div className="driveway-lane grid gap-3 rounded-xl border border-(--line) bg-(--sage-2) p-3" style={{ gridTemplateColumns: `repeat(${width}, minmax(150px, 1fr))`, minWidth: width * 166 }}>
                  {previewVehicles.length === 0 && <p className="col-span-full py-5 text-center text-sm text-(--muted)">Add your first vehicle to arrange the driveway.</p>}
                  {Array.from({ length: slotCount }, (_, index) => {
                    const vehicle = previewVehicles[index]
                    return <Fragment key={vehicle?.id ?? `empty-${index}`}>
                    {savedGarageRows > 0 && index === garageStart && <div className="col-span-full border-t-2 border-dashed border-(--line-strong) pt-4 text-center text-sm font-bold">Garage · {savedGarageRows} row{savedGarageRows === 1 ? '' : 's'} × {width} spaces</div>}
                    {vehicle ? <SortableVehicle
                      vehicle={vehicle}
                      index={index}
                      width={width}
                      inGarage={savedGarageRows > 0 && index >= garageStart}
                      owner={data.members.find((member) => member.id === vehicle.ownerMemberId)!}
                    /> : <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-(--line-strong) text-xs text-(--muted)">Empty {index >= garageStart ? 'garage' : 'driveway'} space</div>}
                    </Fragment>
                  })}
                </div></div>
              </SortableContext>
            </DndContext>
            <p className="mb-4 text-center text-xs text-(--muted)">Only cars ahead in the same column block an exit.</p>
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
              const order = data.vehicles.map(v => v.id)
              const target = order.indexOf(departure.vehicleId)
              const blockers = order.filter((_, index) => index < target && index % width === target % width)
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
                  <div className="departure-time flex items-start gap-2.25 rounded-none border-y border-[#d3d9ed] bg-transparent py-3 font-sans text-[#4d6098] dark:text-(--blue) tabular-nums">
                    <Clock3 size={17} />
                    <div className="grid min-w-0 gap-1">
                      <strong className="block leading-tight">{formatDateTime(departure.requiredAt)}</strong>
                      <span className="block text-[.76rem] leading-snug text-[#6878a6] dark:text-(--blue)">Alert {departure.warningMinutes} minutes before</span>
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

function SortableVehicle({
  vehicle,
  owner,
  index,
  width,
  inGarage,
}: {
  vehicle: Vehicle
  owner: ReturnType<typeof useAppData>['data']['members'][number]
  index: number
  width: number
  inGarage: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: vehicle.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'vehicle-row relative grid min-h-28 cursor-grab touch-none select-none grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-(--line) bg-(--surface-strong) p-3 active:cursor-grabbing',
        isDragging && 'is-dragging z-[5] bg-(--surface-strong)! opacity-[.85] shadow-[0_12px_28px_rgba(30,48,40,.14)]',
      )}
      {...attributes}
      {...listeners}
    >
      <span className={"drag-handle p-0.75 text-[#9fa49f]"} aria-hidden="true">
        <GripVertical />
      </span>
      <span className="text-xs text-(--muted)">Lane {index % width + 1} · <PositionNumber value={Math.floor(index / width) + 1} />{inGarage ? " · Garage" : ""}</span>
      <div className={"vehicle-art w-10.5 h-8 grid place-items-center text-white rounded-[7px]"} style={{ background: vehicle.color }}>
        <CarFront />
      </div>
      <div className="vehicle-name col-span-2 min-w-0">
        <strong className="block text-[.88rem]">{vehicle.label}</strong>
        <span className="mt-0.75 block text-[.75rem] tracking-[.02em] text-(--muted)">{vehicle.plate}</span>
      </div>
      <Avatar initials={owner.initials} color={owner.color} imageUrl={owner.avatarUrl} size="sm" />
      <span className={"owner-name col-span-full truncate text-(--muted) text-[.75rem]"}>{owner.displayName}</span>
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
    <span ref={numberRef} className="position-number text-center text-[.75rem] font-extrabold tabular-nums text-(--muted)">
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

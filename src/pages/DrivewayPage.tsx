import { useState } from 'react'
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
  const [vehicleId, setVehicleId] = useState(data.vehicles[0]?.id ?? '')
  const [requiredAt, setRequiredAt] = useState('')
  const [label, setLabel] = useState('')
  const [warningMinutes, setWarningMinutes] = useState(60)
  const [repeat, setRepeat] = useState<'once' | 'daily' | 'weekly'>('once')
  const [editingVehicleId, setEditingVehicleId] = useState('')
  const [vehicleLabel, setVehicleLabel] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [vehicleColor, setVehicleColor] = useState('#3e6d2d')
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

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">NO MORE DRIVEWAY TEXT CHAINS</p>
          <h1>Driveway</h1>
          <p>The current lineup decides exactly who needs to move.</p>
        </div>
        <div className="button-row">
          <Button variant="secondary" onClick={() => setVehicleModal(true)}>
            <CarFront size={18} /> Add vehicle
          </Button>
          <Button onClick={() => setDepartureModal(true)}>
            <Plus size={18} /> Need my car
          </Button>
        </div>
      </header>

      <div className="driveway-layout">
        <section>
          <SectionHeader
            eyebrow="LIVE LINEUP"
            title="Street to back"
            description={`Version ${data.drivewayVersion} · drag cars to update`}
          />
          <Card className="driveway-card">
            <div className="street-label">
              <span />
              STREET / EXIT
              <span />
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
                <div className="driveway-lane">
                  {data.vehicles.map((vehicle, index) => (
                    <SortableVehicle
                      key={vehicle.id}
                      vehicle={vehicle}
                      index={index}
                      owner={data.members.find((member) => member.id === vehicle.ownerMemberId)!}
                      canManage={vehicle.ownerMemberId === data.household.currentMemberId}
                      onEdit={() => {
                        setEditingVehicleId(vehicle.id)
                        setVehicleLabel(vehicle.label)
                        setVehiclePlate(vehicle.plate ?? '')
                        setVehicleColor(vehicle.color)
                        setVehicleModal(true)
                      }}
                      onRemove={() => void removeVehicle(vehicle.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="back-label"><ArrowDown size={16} /> BACK OF DRIVEWAY</div>
            {busy === 'driveway:reorder' && <div className="driveway-saving">Updating lineup…</div>}
          </Card>
        </section>

        <section>
          <SectionHeader eyebrow="DEPARTURES" title="Who needs out" />
          <div className="departure-list">
            {data.departures.map((departure) => {
              const vehicle = data.vehicles.find((item) => item.id === departure.vehicleId)!
              const owner = data.members.find((item) => item.id === departure.ownerMemberId)!
              const blockers = departure.blockerVehicleIds
                .map((id) => data.vehicles.find((item) => item.id === id))
                .filter(Boolean)
              return (
                <Card className="departure-card" key={departure.id}>
                  <div className="departure-card-top">
                    <div className="car-swatch" style={{ background: vehicle.color }}>
                      <CarFront />
                    </div>
                    <div>
                      <strong>{vehicle.label}</strong>
                      <span>{owner.displayName} · {departure.sourceLabel}</span>
                    </div>
                    <Badge tone="blue">{timeUntil(departure.requiredAt)}</Badge>
                  </div>
                  <div className="departure-time">
                    <Clock3 size={17} />
                    <div><strong>{formatDateTime(departure.requiredAt)}</strong><span>Alert {departure.warningMinutes} minutes before</span></div>
                  </div>
                  <div className="blocker-box">
                    <div><Route size={17} /><span>{blockers.length} blocking car{blockers.length === 1 ? '' : 's'}</span></div>
                    {blockers.length ? (
                      blockers.map((blocker) => {
                        const blockerOwner = data.members.find((member) => member.id === blocker!.ownerMemberId)!
                        return (
                          <div className="blocker-person" key={blocker!.id}>
                            <Avatar initials={blockerOwner.initials} color={blockerOwner.color} size="sm" />
                            <span>{blockerOwner.displayName} moves {blocker!.label}</span>
                            <BellRing size={15} />
                          </div>
                        )
                      })
                    ) : (
                      <span className="all-clear-text">Clear path to the street.</span>
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
        title="Plan a departure"
        description="The current blockers will be notified one hour beforehand."
      >
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!vehicleId || !requiredAt) return
            await addDeparture(
              vehicleId,
              toIso(new Date(requiredAt)),
              label || 'Manual departure',
              warningMinutes,
              repeat === 'once' ? undefined : { frequency: repeat, interval: 1 },
            )
            setDepartureModal(false)
            setLabel('')
            setRequiredAt('')
          }}
        >
          <label className="field-span-2">Vehicle
            <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {data.vehicles.map((vehicle) => (
                <option value={vehicle.id} key={vehicle.id}>{vehicle.label}</option>
              ))}
            </select>
          </label>
          <label>Needs out at
            <input type="datetime-local" value={requiredAt} onChange={(event) => setRequiredAt(event.target.value)} required />
          </label>
          <label>Reason
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
          <div className="modal-actions field-span-2">
            <Button type="button" variant="ghost" onClick={() => setDepartureModal(false)}>Cancel</Button>
            <Button type="submit">Create departure</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={vehicleModal}
        onClose={() => setVehicleModal(false)}
        title={editingVehicleId ? 'Edit vehicle' : 'Add a vehicle'}
        description="Only you can edit or remove vehicles you own."
      >
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!vehicleLabel.trim()) return
            await saveVehicle({
              id: editingVehicleId || undefined,
              label: vehicleLabel.trim(),
              plate: vehiclePlate.trim() || undefined,
              color: vehicleColor,
            })
            setVehicleModal(false)
            setEditingVehicleId('')
            setVehicleLabel('')
            setVehiclePlate('')
          }}
        >
          <label>Vehicle name
            <input value={vehicleLabel} onChange={(event) => setVehicleLabel(event.target.value)} placeholder="Blue Civic" required />
          </label>
          <label>Plate
            <input value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value)} placeholder="ABC 123" />
          </label>
          <label>Color
            <input type="color" value={vehicleColor} onChange={(event) => setVehicleColor(event.target.value)} />
          </label>
          <div className="modal-actions field-span-2">
            <Button type="button" variant="ghost" onClick={() => setVehicleModal(false)}>Cancel</Button>
            <Button type="submit">{editingVehicleId ? 'Save changes' : 'Add vehicle'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function SortableVehicle({
  vehicle,
  owner,
  index,
  canManage,
  onEdit,
  onRemove,
}: {
  vehicle: Vehicle
  owner: ReturnType<typeof useAppData>['data']['members'][number]
  index: number
  canManage: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: vehicle.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`vehicle-row ${isDragging ? 'is-dragging' : ''}`}
    >
      <button className="drag-handle" {...attributes} {...listeners} aria-label={`Move ${vehicle.label}`}>
        <GripVertical />
      </button>
      <span className="position-number">{index + 1}</span>
      <div className="vehicle-art" style={{ background: vehicle.color }}>
        <CarFront />
      </div>
      <div className="vehicle-name">
        <strong>{vehicle.label}</strong>
        <span>{vehicle.plate}</span>
      </div>
      <Avatar initials={owner.initials} color={owner.color} size="sm" />
      <span className="owner-name">{owner.displayName}</span>
      {canManage && (
        <div className="vehicle-actions">
          <button type="button" onClick={onEdit} aria-label={`Edit ${vehicle.label}`}><Pencil size={15} /></button>
          <button type="button" onClick={onRemove} aria-label={`Remove ${vehicle.label}`}><Trash2 size={15} /></button>
        </div>
      )}
    </div>
  )
}

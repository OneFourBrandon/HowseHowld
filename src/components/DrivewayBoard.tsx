import { useRef, useState, type PointerEvent } from 'react'
import { ArrowDown, CarFront, Grip, House, Minus, Plus, Settings2, Trash2 } from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { assignVehicle, nextSlotPosition, slotsFor, validSlot } from '../lib/driveway'
import type { DrivewaySlot } from '../types'
import { Button, Modal } from './ui'
import { cn } from '../lib/cn'

type Gesture = {
  mode: 'move' | 'left' | 'right' | 'top' | 'bottom' | 'car'
  id: string
  startX: number
  startY: number
  canvasX: number
  canvasY: number
  original: DrivewaySlot[]
  moved: boolean
}

export function DrivewayBoard() {
  const { data, saveDrivewaySlots, parkVehicle, busy } = useAppData()
  const saved = slotsFor(data)
  const owner = data.members.find(member => member.id === data.household.currentMemberId)?.role === 'owner'
  const [draft, setDraft] = useState<DrivewaySlot[] | null>(null)
  const draftRef = useRef<DrivewaySlot[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [editSize, setEditSize] = useState({ columns: 8, rows: 8 })
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const slots = draft ?? saved
  const editing = draft !== null
  const cellWidth = 152 * zoom
  const cellHeight = 172 * zoom
  const showGrid = editing
  const columns = editing ? editSize.columns : Math.max(1, ...slots.map(slot => slot.x + slot.width))
  const rows = editing ? editSize.rows : Math.max(1, ...slots.map(slot => slot.y + slot.height))
  const tile = slots.find(slot => slot.id === selected)
  const saving = busy === 'driveway:slots' || busy === 'driveway:park'
  const parked = new Set(saved.map(slot => slot.vehicleId))
  const unparked = data.vehicles.filter(vehicle => !parked.has(vehicle.id))

  const updateDraft = (next: DrivewaySlot[]) => {
    const startingEdit = draftRef.current === null
    // Editing space can grow to the right/down, but never shrink under a gesture.
    setEditSize(current => ({
      columns: Math.max(startingEdit ? 8 : current.columns, ...next.map(slot => slot.x + slot.width + 2)),
      rows: Math.max(startingEdit ? 8 : current.rows, ...next.map(slot => slot.y + slot.height + 2)),
    }))
    draftRef.current = next
    setDraft(next)
  }
  const beginEditing = () => { updateDraft(saved.map(slot => ({ ...slot }))); setError(''); setSelected(null) }
  const addSlot = () => {
    const current = draftRef.current ?? saved
    const next: DrivewaySlot = { id: crypto.randomUUID(), ...nextSlotPosition(current), width: 1, height: 1, kind: 'driveway' }
    updateDraft([...current, next]); setError('')
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: Math.max(0, next.y * cellHeight - cellHeight), left: Math.max(0, next.x * cellWidth - cellWidth), behavior: 'smooth' }))
  }
  const changeTile = (patch: Partial<DrivewaySlot>) => {
    if (!tile || !draft) return
    const next = { ...tile, ...patch }
    if (!validSlot(next, draft)) { setError('Slots cannot overlap. Move the neighboring slot first.'); return }
    updateDraft(draft.map(slot => slot.id === tile.id ? next : slot)); setError('')
  }

  const start = (event: PointerEvent<HTMLElement>, mode: Gesture['mode'], id: string) => {
    if (saving || event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = canvas.current!.getBoundingClientRect()
    gesture.current = { mode, id, startX: event.clientX, startY: event.clientY,
      canvasX: rect.left, canvasY: rect.top,
      original: slots.map(slot => ({ ...slot })), moved: false }
    suppressClick.current = false
  }
  const move = (event: PointerEvent) => {
    const g = gesture.current
    const scroll = scroller.current
    if (!g || !scroll || !canvas.current) return
    if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) < 5 && !g.moved) return
    g.moved = true; suppressClick.current = true; setDragging(g.id)
    const bounds = scroll.getBoundingClientRect()
    if (event.clientX > bounds.right - 32) scroll.scrollLeft += 18
    if (event.clientX < bounds.left + 32) scroll.scrollLeft -= 18
    if (event.clientY > bounds.bottom - 32) scroll.scrollTop += 18
    if (event.clientY < bounds.top + 32) scroll.scrollTop -= 18
    if (g.mode === 'car') {
      const rect = canvas.current.getBoundingClientRect()
      const x = (event.clientX - rect.left) / cellWidth, y = (event.clientY - rect.top) / cellHeight
      setDropId(saved.find(slot => x >= slot.x && x < slot.x + slot.width && y >= slot.y && y < slot.y + slot.height)?.id ?? null)
      return
    }
    const original = g.original.find(slot => slot.id === g.id)!
    const rect = canvas.current.getBoundingClientRect()
    const dx = Math.round((event.clientX - g.startX + g.canvasX - rect.left) / cellWidth)
    const dy = Math.round((event.clientY - g.startY + g.canvasY - rect.top) / cellHeight)
    let next = { ...original }
    if (g.mode === 'move') next = { ...next, x: Math.max(0, original.x + dx), y: Math.max(0, original.y + dy) }
    if (g.mode === 'right') next.width = Math.max(1, original.width + dx)
    if (g.mode === 'bottom') next.height = Math.max(1, original.height + dy)
    if (g.mode === 'left') { next.x = Math.max(0, Math.min(original.x + original.width - 1, original.x + dx)); next.width = original.x + original.width - next.x }
    if (g.mode === 'top') { next.y = Math.max(0, Math.min(original.y + original.height - 1, original.y + dy)); next.height = original.y + original.height - next.y }
    const valid = validSlot(next, g.original)
    setInvalid(!valid)
    if (valid) updateDraft(g.original.map(slot => slot.id === g.id ? next : slot))
  }
  const finish = async (cancelled = false) => {
    const g = gesture.current
    gesture.current = null; setDragging(null); setInvalid(false); setDropId(null)
    window.setTimeout(() => { suppressClick.current = false }, 0)
    if (!g) return
    if (cancelled && g.mode !== 'car') updateDraft(g.original)
    if (!cancelled && g.moved && g.mode === 'car') {
      if (!dropId) { setError('Drop the car inside a parking slot.'); return }
      try { assignVehicle(saved, g.id, dropId); await parkVehicle(g.id, dropId); setError('') }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not park the vehicle.') }
    }
  }

  return <section className="min-w-0 rounded-2xl border border-(--line) bg-(--surface-strong) p-4 sm:p-5" onPointerMove={move} onPointerUp={() => void finish()} onPointerCancel={() => void finish(true)}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl!">Your driveway</h2><p className="mt-1 text-xs text-(--muted)">{editing ? 'Drag anywhere on a slot to move it. Drag any edge to resize it.' : 'Drag cars between slots, or tap a slot to park a vehicle.'}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-(--line)">
          <button type="button" className="grid size-9 place-items-center" aria-label="Zoom out driveway" onClick={() => setZoom(value => Math.max(.5, value - .1))}><Minus size={15} /></button>
          <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" className="grid size-9 place-items-center" aria-label="Zoom in driveway" onClick={() => setZoom(value => Math.min(1.5, value + .1))}><Plus size={15} /></button>
        </div>
        {owner && (editing ? <>
          <Button size="sm" variant="secondary" onClick={addSlot} disabled={saving}><Plus size={16} /> Add slot</Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => { setDraft(null); draftRef.current = null; setSelected(null); setError('') }}>Cancel</Button>
          <Button size="sm" disabled={saving || Boolean(dragging)} onClick={async () => {
            try { await saveDrivewaySlots(draft); setDraft(null); draftRef.current = null; setSelected(null); setError('') }
            catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save driveway.') }
          }}>{saving ? 'Saving…' : 'Save driveway'}</Button>
        </> : <><Button size="sm" variant="secondary" onClick={beginEditing}><Settings2 size={16} /> Edit layout</Button><Button size="sm" onClick={addSlot}><Plus size={16} /> Add slot</Button></>)}
      </div>
    </div>
    {(error || invalid) && <p className="mb-3 rounded-lg bg-(--coral-soft) p-3 text-sm text-(--coral)" role="alert">{invalid ? 'There is another slot in the way.' : error}</p>}
    <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold tracking-widest text-(--muted)"><ArrowDown className="rotate-180" size={16} /> STREET / EXIT</div>
    <div ref={scroller} className={cn('mx-auto mb-6 max-w-full max-h-[65vh] overflow-auto overscroll-contain rounded-xl border border-(--line) bg-(--paper)', editing ? 'w-full' : 'w-fit')} tabIndex={0} aria-label="Driveway grid">
      <div ref={canvas} className="relative" style={{ width: columns * cellWidth, height: rows * cellHeight, backgroundSize: `${cellWidth}px ${cellHeight}px`, backgroundImage: showGrid ? 'linear-gradient(to right,var(--line) 1px,transparent 1px),linear-gradient(to bottom,var(--line) 1px,transparent 1px)' : 'none' }}>
        {slots.map((slot, index) => {
          const vehicle = data.vehicles.find(car => car.id === slot.vehicleId)
          const member = data.members.find(person => person.id === vehicle?.ownerMemberId)
          const garage = slot.kind === 'garage'
          return <div key={slot.id} data-slot-id={slot.id} data-slot-x={slot.x} data-slot-y={slot.y} data-slot-width={slot.width} data-slot-height={slot.height}
            onPointerDown={event => { if (editing) start(event, 'move', slot.id); else if (vehicle) start(event, 'car', vehicle.id) }}
            onClick={() => { if (suppressClick.current || saving) return; setSelected(slot.id) }}
            className={cn('absolute rounded-xl border-2 p-3 transition-colors', (editing || vehicle) && 'touch-none select-none cursor-grab active:cursor-grabbing', garage ? 'border-(--muted) bg-(--sage-2)' : 'border-(--line-strong) bg-(--surface-strong)', dragging === slot.id && 'z-10 shadow-lg', dropId === slot.id && 'border-(--green)! bg-(--green-soft)!')}
            style={{ left: slot.x * cellWidth + 6, top: slot.y * cellHeight + 6, width: slot.width * cellWidth - 12, height: slot.height * cellHeight - 12 }}>
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-bold uppercase tracking-wide text-(--muted)">{garage ? 'Garage' : 'Slot'} {index + 1}</span>
              {editing ? <button type="button" className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md hover:bg-(--sage-2)" aria-label={`Move slot ${index + 1}`} onPointerDown={event => start(event, 'move', slot.id)}><Grip size={15} /></button> : garage ? <House size={15} className="shrink-0 text-(--muted)" /> : null}
            </div>
            <button type="button" disabled={saving} className={cn('flex h-[calc(100%-28px)] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg text-center', !editing && vehicle && 'cursor-grab touch-none active:cursor-grabbing')}
              aria-label={`${editing ? 'Properties for' : 'Park in'} slot ${index + 1}${vehicle ? `: ${vehicle.label}` : ': empty'}`}
              >
              {vehicle ? <><CarFront className="shrink-0 text-(--forest-2)" size={Math.max(22, 34 * zoom)} /><strong className="w-full truncate text-xs">{vehicle.label}</strong><span className="w-full truncate text-[10px] text-(--muted)">{member?.displayName}</span></> : <><Plus className="text-(--muted)" size={22} /><span className="text-xs text-(--muted)">{editing ? 'Slot properties' : 'Park here'}</span></>}
            </button>
            {editing && (['left', 'right', 'top', 'bottom'] as const).map(edge => <button type="button" key={edge}
              aria-label={`Resize slot ${index + 1} ${edge}`}
              className={cn('absolute z-20 touch-none rounded-full bg-(--forest-2) opacity-75', edge === 'left' && '-left-1.5 top-1/2 h-8 w-3 -translate-y-1/2 cursor-ew-resize', edge === 'right' && '-right-1.5 top-1/2 h-8 w-3 -translate-y-1/2 cursor-ew-resize', edge === 'top' && '-top-1.5 left-1/2 h-3 w-8 -translate-x-1/2 cursor-ns-resize', edge === 'bottom' && '-bottom-1.5 left-1/2 h-3 w-8 -translate-x-1/2 cursor-ns-resize')}
              onClick={event => event.stopPropagation()}
              onPointerDown={event => start(event, edge, slot.id)} />)}
          </div>
        })}
        {!slots.length && <p className="absolute inset-5 flex items-center justify-center text-center text-sm text-(--muted)">{owner ? 'Add a slot to start building your driveway.' : 'Your admin has not added parking slots yet.'}</p>}
      </div>
    </div>
    <p className="text-xs text-(--muted)">One car per tile, including stretched tiles. Cars above an overlapping part of your slot must move for you to exit.</p>
    {unparked.length > 0 && <div className="mt-4 border-t border-(--line) pt-4"><h3 className="mb-2 text-sm font-bold">Not parked</h3><div className="flex flex-wrap gap-2">{unparked.map(vehicle => <button type="button" key={vehicle.id} disabled={editing || saving} className="inline-flex touch-none items-center gap-2 rounded-lg border border-(--line) bg-(--paper) px-3 py-2 text-xs disabled:opacity-50" onPointerDown={event => start(event, 'car', vehicle.id)}><CarFront size={16} />{vehicle.label}</button>)}</div><p className="mt-2 text-xs text-(--muted)">Drag a car into a slot, or tap an empty slot and choose its vehicle.</p></div>}
    <Modal open={Boolean(tile)} title={editing ? 'Slot properties' : 'Park a vehicle'} onClose={() => setSelected(null)}>
      {tile && <div className="grid gap-4">
        {editing ? <>
          <label>Slot type<select value={tile.kind} onChange={event => changeTile({ kind: event.target.value as DrivewaySlot['kind'] })}><option value="driveway">Driveway</option><option value="garage">Garage</option></select></label>
          <div className="grid grid-cols-2 gap-3">{(['x', 'y', 'width', 'height'] as const).map(field => <label key={field}>{({ x: 'Column', y: 'Row', width: 'Width (cells)', height: 'Length (cells)' })[field]}<input type="number" inputMode="numeric" min={1} value={tile[field] + (field === 'x' || field === 'y' ? 1 : 0)} onChange={event => changeTile({ [field]: Number(event.target.value) - (field === 'x' || field === 'y' ? 1 : 0) })} /></label>)}</div>
          <p className="text-xs text-(--muted)">Changing the size keeps this as one parking slot.</p>
          <Button variant="danger" disabled={Boolean(tile.vehicleId)} onClick={() => { updateDraft(draft!.filter(slot => slot.id !== tile.id)); setSelected(null) }}><Trash2 size={16} /> Delete slot</Button>
          {tile.vehicleId && <p className="text-xs text-(--muted)">Unpark the vehicle before deleting this slot.</p>}
        </> : <label>Vehicle<select value={tile.vehicleId ?? ''} disabled={saving} onChange={async event => {
          try {
            if (event.target.value) await parkVehicle(event.target.value, tile.id)
            else if (tile.vehicleId) await parkVehicle(tile.vehicleId, null)
            setSelected(null); setError('')
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not park vehicle.'); setSelected(null) }
        }}><option value="">Empty / unpark vehicle</option>{data.vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id} disabled={Boolean(tile.vehicleId) && !parked.has(vehicle.id)}>{vehicle.label}{parked.has(vehicle.id) && vehicle.id !== tile.vehicleId ? ' (swap slots)' : ''}</option>)}</select></label>}
        <Button variant="secondary" onClick={() => setSelected(null)}>Done</Button>
      </div>}
    </Modal>
  </section>
}

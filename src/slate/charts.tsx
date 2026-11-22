import { type CSSProperties, useId } from 'react'
import { cn } from '../lib/cn'
import { type AgendaKind, type DayLoad, type GridCell, dateFromKey } from '../lib/insights'
import type { DrivewaySlot, Member, Vehicle } from '../types'
import { axisMax, kindLabel, kindTone } from './kinds'
import { type Tone, toneClass } from './tone'

const fullDay = new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-CA', { month: 'short', timeZone: 'UTC' })

function describeDay(day: DayLoad) {
  const counts = new Map<AgendaKind, number>()
  for (const block of day.blocks) counts.set(block.kind, (counts.get(block.kind) ?? 0) + 1)
  const parts = [...counts.entries()].map(([kind, count]) => `${count} ${kindLabel[kind][count === 1 ? 0 : 1]}`)
  return `${fullDay.format(dateFromKey(day.dateKey))}: ${parts.length ? parts.join(', ') : 'nothing scheduled'}`
}

/**
 * The house's days as stacks of blocks, one block per thing on that day.
 * Solid blocks have happened, hatched blocks are still ahead, and a missed
 * chore keeps its place in brick. Picking a column selects that day.
 */
export function LoadChart({
  days,
  selected,
  onSelect,
  className,
}: {
  days: DayLoad[]
  selected: string
  onSelect: (dateKey: string) => void
  className?: string
}) {
  const tallest = Math.max(1, ...days.map(day => day.blocks.length))
  // Blocks shrink to keep the busiest day inside the plot, down to a readable floor.
  const unit = Math.max(4, Math.min(18, Math.floor((116 - (tallest - 1) * 2) / tallest)))
  return (
    <div className={cn('sl-load', className)} role="group" aria-label="Days around today" style={{ '--unit': `${unit}px` } as CSSProperties}>
      {days.map((day, index) => {
        const date = dateFromKey(day.dateKey)
        const dayOfMonth = date.getUTCDate()
        const key = day.relation === 'today' || date.getUTCDay() === 1
        return (
          <button
            type="button"
            className="sl-load-day"
            key={day.dateKey}
            data-relation={day.relation}
            aria-pressed={selected === day.dateKey}
            aria-label={describeDay(day)}
            title={describeDay(day)}
            style={{ '--i': index } as CSSProperties}
            onClick={() => onSelect(day.dateKey)}
          >
            <span className="sl-load-stack">
              {day.blocks.map((block, position) => (
                <i
                  key={position}
                  className={cn('sl-load-block', toneClass(block.fill === 'missed' ? 'brick' : kindTone[block.kind]))}
                  data-fill={block.fill}
                />
              ))}
            </span>
            <span className="sl-load-tick" data-key={key || undefined}>
              {dayOfMonth === 1 ? monthShort.format(date) : dayOfMonth}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Who did what: a row per roommate, a cell per day. */
export function HeatGrid({
  days,
  rows,
  today,
  renderLabel,
}: {
  days: string[]
  rows: Array<{ member: Member; cells: GridCell[] }>
  today: string
  renderLabel: (member: Member) => React.ReactNode
}) {
  return (
    <div className="sl-heat" style={{ '--days': days.length } as CSSProperties}>
      {rows.map(row => (
        <div className="sl-heat-row" key={row.member.id} role="group" aria-label={`${row.member.displayName}'s chores by day`}>
          <div className="sl-heat-label">{renderLabel(row.member)}</div>
          {row.cells.map(cell => {
            const state = cell.missed ? 'missed' : cell.open ? 'open' : cell.done ? 'done' : 'none'
            const total = cell.done + cell.missed + cell.open
            const label = `${fullDay.format(dateFromKey(cell.dateKey))}: ${
              total === 0 ? 'no chores'
                : [cell.done && `${cell.done} done`, cell.missed && `${cell.missed} missed`, cell.open && `${cell.open} to do`]
                    .filter(Boolean).join(', ')}`
            return (
              <i
                key={cell.dateKey}
                className={cn('sl-heat-cell', state === 'missed' ? 'sl-tone-brick' : 'sl-tone-moss')}
                data-state={state}
                data-today={cell.dateKey === today || undefined}
                data-many={total > 1 || undefined}
                title={label}
                role="img"
                aria-label={label}
              />
            )
          })}
        </div>
      ))}
      <div className="sl-heat-row sl-heat-axis" aria-hidden="true">
        <div />
        {days.map(dateKey => {
          const date = dateFromKey(dateKey)
          const show = dateKey === today || date.getUTCDay() === 1
          return <span key={dateKey} data-today={dateKey === today || undefined}>{show ? date.getUTCDate() : ''}</span>
        })}
      </div>
    </div>
  )
}

/**
 * A running total through a period. What has happened is drawn solid; what is
 * already scheduled for the rest of the period is drawn hatched, like every
 * other "still ahead" in slate. An optional fainter line gives a comparison.
 * Shapes stretch to the box; labels are HTML so they never distort.
 */
export function AreaChart({
  values,
  through,
  compare,
  tone = 'moss',
  formatY,
  xLabels,
  label,
  className,
}: {
  /** One value per step, for the whole period. */
  values: number[]
  /** How many steps have happened. The rest are drawn as still ahead. */
  through: number
  compare?: number[]
  tone?: Tone
  formatY: (value: number) => string
  xLabels: Array<{ at: number; label: string }>
  label: string
  className?: string
}) {
  const gradientId = useId()
  const steps = Math.max(values.length, 2)
  const happened = Math.max(0, Math.min(through, values.length))
  const top = axisMax(Math.max(1, ...values, ...(compare ?? [])))
  const x = (index: number) => (index / (steps - 1)) * 100
  const y = (value: number) => 100 - (value / top) * 100
  const points = values.map((value, index) => [x(index), y(value)] as const)
  const path = (series: ReadonlyArray<readonly [number, number]>) => series
    .map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`)
    .join(' ')

  const solid = points.slice(0, happened)
  const joint = Math.max(0, happened - 1)
  // Only draw the rest of the period when something is actually scheduled in it.
  const rises = happened < values.length && values[values.length - 1] > (happened ? values[joint] : 0)
  const ahead = rises ? points.slice(joint) : []
  const ticks = [1, .75, .5, .25, 0]
  const inProgress = happened > 0 && happened < values.length

  return (
    <div className={cn('sl-chart', toneClass(tone), className)} role="img" aria-label={label}>
      <div className="sl-chart-plot">
        {ahead.length > 1 && (
          <div
            className="sl-chart-ahead"
            style={{
              clipPath: `polygon(${[...ahead, [ahead[ahead.length - 1][0], 100] as const, [ahead[0][0], 100] as const]
                .map(([px, py]) => `${px.toFixed(2)}% ${py.toFixed(2)}%`).join(', ')})`,
            }}
          />
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--tone)" stopOpacity=".3" />
              <stop offset="1" stopColor="var(--tone)" stopOpacity=".05" />
            </linearGradient>
          </defs>
          {ticks.map(tick => (
            <line key={tick} className="sl-chart-grid" x1="0" x2="100" y1={100 - tick * 100} y2={100 - tick * 100} />
          ))}
          {compare && compare.length > 1 && (
            <path className="sl-chart-compare" d={path(compare.map((value, index) => [x(index), y(value)] as const))} />
          )}
          {solid.length > 1 && (
            <>
              <path d={`${path(solid)} L${solid[solid.length - 1][0].toFixed(2)} 100 L0 100 Z`} fill={`url(#${gradientId})`} />
              <path className="sl-chart-line" d={path(solid)} />
            </>
          )}
          {ahead.length > 1 && <path className="sl-chart-line sl-chart-line-ahead" d={path(ahead)} />}
        </svg>
        {inProgress && (
          <span
            className="sl-chart-cursor"
            style={{ left: `${points[joint][0]}%`, '--at': `${points[joint][1]}%` } as CSSProperties}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="sl-chart-y" aria-hidden="true">
        {ticks.map(tick => <span key={tick}>{formatY(top * tick)}</span>)}
      </div>
      <div className="sl-chart-x" aria-hidden="true">
        {xLabels.map(item => (
          <span key={item.at} style={{ left: `${x(item.at)}%` }}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

/** A handful of period totals as plain bars, the last one emphasised. */
export function MiniBars({
  items,
  format,
  className,
}: {
  items: Array<{ key: string; label: string; value: number }>
  format: (value: number) => string
  className?: string
}) {
  const peak = Math.max(1, ...items.map(item => item.value))
  return (
    <div className={cn('sl-minibars', className)} role="list">
      {items.map((item, index) => (
        <div
          key={item.key}
          role="listitem"
          className="sl-minibar"
          data-current={index === items.length - 1 || undefined}
          title={`${item.label}: ${format(item.value)}`}
          aria-label={`${item.label}: ${format(item.value)}`}
        >
          <i style={{ height: `${Math.max(item.value > 0 ? 4 : 0, (item.value / peak) * 100)}%` }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/** The driveway in miniature. The street is at the top, as on the full board. */
export function DrivewayMini({
  slots,
  vehicles,
  members,
  highlightVehicleIds = [],
  className,
}: {
  slots: DrivewaySlot[]
  vehicles: Vehicle[]
  members: Member[]
  highlightVehicleIds?: string[]
  className?: string
}) {
  if (!slots.length) return null
  const columns = Math.max(1, ...slots.map(slot => slot.x + slot.width))
  return (
    <div
      className={cn('sl-lot', className)}
      style={{ '--cols': columns } as CSSProperties}
      role="img"
      aria-label={`Driveway, ${slots.filter(slot => slot.vehicleId).length} of ${slots.length} slots taken`}
    >
      {slots.map(slot => {
        const vehicle = vehicles.find(item => item.id === slot.vehicleId)
        const owner = members.find(member => member.id === vehicle?.ownerMemberId)
        return (
          <span
            key={slot.id}
            className="sl-lot-slot"
            data-empty={!vehicle || undefined}
            data-kind={slot.kind}
            data-highlight={(vehicle && highlightVehicleIds.includes(vehicle.id)) || undefined}
            title={vehicle ? `${vehicle.label}${owner ? `, ${owner.displayName}` : ''}` : 'Empty slot'}
            style={{
              gridColumn: `${slot.x + 1} / span ${slot.width}`,
              gridRow: `${slot.y + 1} / span ${slot.height}`,
              '--car': vehicle?.color,
            } as CSSProperties}
          >
            {owner?.initials}
          </span>
        )
      })}
    </div>
  )
}

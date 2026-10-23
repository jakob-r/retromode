import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { COLUMNS, type ColumnKey, type EntryRef, type PublicBoard } from '@retromode/shared'
import { accentVars, COLUMN_META } from '../lib/columns'
import * as model from '../lib/model'
import { actions, boardData, useBoard, useBoardData } from '../store/board'
import { useDrag, type DropHint } from '../store/drag'
import { Column } from './Column'
import { GroupCard } from './GroupCard'
import { ItemCard } from './ItemCard'
import { Strings } from './Strings'

type DropData =
  | { kind: 'item'; id: string; groupId: string | null; column: ColumnKey }
  | { kind: 'group'; id: string; column: ColumnKey }
  | { kind: 'column'; column: ColumnKey }

/** Innermost droppable under the pointer wins (an item inside a group beats the group). */
const innermostUnderPointer: CollisionDetection = (args) => {
  const area = (id: string | number) => {
    const r = args.droppableRects.get(id)
    return r ? r.width * r.height : Infinity
  }
  return pointerWithin(args).sort((a, b) => area(a.id) - area(b.id))
}

function pointerY(event: DragMoveEvent): number | null {
  const e = event.activatorEvent
  const start =
    'clientY' in e ? (e as PointerEvent).clientY : (e as TouchEvent).touches?.[0]?.clientY
  return start === undefined ? null : start + event.delta.y
}

/** Decides what dropping here means: insert before/after, merge, tie, or append to the column. */
function computeHint(active: EntryRef, event: DragMoveEvent): DropHint | null {
  const over = event.over
  const data = over?.data.current as DropData | undefined
  const y = pointerY(event)
  if (!over || !data || y === null) return null
  if (data.kind === 'column') return { key: `column:${data.column}`, mode: 'end' }

  const rect = over.rect
  // An action item and something to improve get tied together instead of merged
  const merge = model.linkBetween(useBoard.getState(), active, { type: data.kind, id: data.id })
    ? 'link'
    : 'merge'
  if (data.kind === 'item') {
    // A dragged group treats items inside another group as that group
    if (merge === 'merge' && active.type === 'group' && data.groupId)
      return { key: `group:${data.groupId}`, mode: 'merge' }
    const rel = (y - rect.top) / rect.height
    const mode = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : merge
    return { key: `item:${data.id}`, mode }
  }
  const edge = Math.min(18, rect.height * 0.2)
  const mode = y < rect.top + edge ? 'before' : y > rect.bottom - edge ? 'after' : merge
  return { key: `group:${data.id}`, mode }
}

function parseKey(key: string): { type: 'item' | 'group' | 'column'; id: string } {
  const [type, id] = key.split(':') as ['item' | 'group' | 'column', string]
  return { type, id }
}

function executeDrop(active: EntryRef, hint: DropHint) {
  const data = boardData(useBoard.getState())
  const target = parseKey(hint.key)

  if (hint.mode === 'link' && target.type !== 'column') {
    const link = model.linkBetween(data, active, { type: target.type, id: target.id })
    const current = link && data.items[link.itemId]?.link
    if (link && (current?.type !== link.target.type || current.id !== link.target.id)) {
      actions.linkItem(link.itemId, link.target)
    }
    return
  }
  if (hint.mode === 'merge' && target.type !== 'column') {
    actions.merge(active, { type: target.type, id: target.id })
    return
  }

  // Resolve the container (column + optional group) and the entry to insert after.
  let column: ColumnKey
  let groupId: string | null = null
  let afterId: string | null
  if (target.type === 'column') {
    column = target.id as ColumnKey
    const entries = model.columnEntries(data, column).filter((e) => e.id !== active.id)
    afterId = entries.at(-1)?.id ?? null
  } else {
    let ref: EntryRef = { type: target.type, id: target.id }
    const targetItem = target.type === 'item' ? data.items[target.id] : undefined
    if (targetItem?.groupId && active.type === 'group')
      ref = { type: 'group', id: targetItem.groupId }
    const refItem = ref.type === 'item' ? data.items[ref.id] : undefined
    groupId = active.type === 'item' ? (refItem?.groupId ?? null) : null
    column = (refItem?.column ?? data.groups[ref.id]?.column)!
    if (!column) return
    // Positions, not the vote-sorted display: "before X" means right after X's predecessor
    const siblings = groupId ? model.groupMembers(data, groupId) : model.columnEntries(data, column)
    const filtered = siblings.filter((e) => e.id !== active.id)
    const index = filtered.findIndex((e) => e.id === ref.id)
    afterId = hint.mode === 'after' ? ref.id : (filtered[index - 1]?.id ?? null)
  }

  if (active.type === 'item') {
    const item = data.items[active.id]
    if (!item) return
    const sameContainer = item.groupId === groupId && (groupId !== null || item.column === column)
    if (sameContainer && model.predecessorId(data, active) === afterId) return
    actions.moveItem(active.id, column, groupId, afterId)
  } else {
    const group = data.groups[active.id]
    if (!group) return
    if (group.column === column && model.predecessorId(data, active) === afterId) return
    actions.moveGroup(active.id, column, afterId)
  }
}

export function BoardColumns({ board }: { board: PublicBoard }) {
  const data = useBoardData()
  const sortVotes = useBoard((s) => s.sortVotes)
  const active = useDrag((s) => s.active)
  const [mobileColumn, setMobileColumn] = useState<ColumnKey>('well')

  const columns = useMemo(
    () =>
      COLUMNS.map((column) => ({
        column,
        entries: model.sortByVotes(model.columnEntries(data, column), sortVotes),
        count: model.columnCount(data, column),
        used: model.votesUsed(data, column),
      })),
    [data, sortVotes],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  )

  const onDragStart = (e: DragStartEvent) => {
    const ref = e.active.data.current as EntryRef | undefined
    if (ref) useDrag.setState({ active: ref, hint: null })
  }
  const onDragMove = (e: DragMoveEvent) => {
    const current = useDrag.getState()
    if (!current.active) return
    const hint = computeHint(current.active, e)
    if (hint?.key !== current.hint?.key || hint?.mode !== current.hint?.mode) {
      useDrag.setState({ hint })
    }
  }
  const onDragEnd = (_e: DragEndEvent) => {
    const { active: ref, hint } = useDrag.getState()
    useDrag.setState({ active: null, hint: null })
    if (ref && hint) executeDrop(ref, hint)
  }
  const onDragCancel = () => useDrag.setState({ active: null, hint: null })

  const overlay = (() => {
    if (!active) return null
    if (active.type === 'item') {
      const item = data.items[active.id]
      if (!item) return null
      return (
        <div style={accentVars(item.column)} className="w-full">
          <ItemCard item={item} canVote locked={false} isOwner={false} overlay />
        </div>
      )
    }
    const entry = columns
      .flatMap((c) => c.entries)
      .find(
        (e): e is Extract<model.Entry, { type: 'group' }> =>
          e.type === 'group' && e.id === active.id,
      )
    if (!entry) return null
    return (
      <div style={accentVars(entry.group.column)}>
        <GroupCard
          group={entry.group}
          items={entry.items}
          votes={entry.votes}
          canVote
          locked={false}
          isOwner={false}
          overlay
        />
      </div>
    )
  })()

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={innermostUnderPointer}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      autoScroll={{ threshold: { x: 0, y: 0.15 } }}
    >
      {/* Mobile: one column at a time, picked with tabs */}
      <div
        className="mb-3 flex gap-1 rounded-[1.75rem] bg-white/70 p-1 shadow-sm md:hidden"
        role="tablist"
      >
        {COLUMNS.map((column) => {
          const meta = COLUMN_META[column]
          const selected = column === mobileColumn
          return (
            <button
              key={column}
              role="tab"
              aria-selected={selected}
              onClick={() => setMobileColumn(column)}
              style={accentVars(column)}
              className={`relative flex-1 rounded-3xl px-1 py-1.5 text-[11px] font-bold transition-colors ${
                selected ? 'text-white' : 'text-[var(--accent-deep)]'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="mobile-tab"
                  className="absolute inset-0 rounded-3xl bg-[var(--accent)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative flex flex-col items-center leading-tight">
                <span className="text-base">{meta.emoji}</span>
                <span className="whitespace-nowrap">{meta.title}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="relative grid items-start gap-4 md:grid-cols-3 lg:gap-5">
        {columns.map((c) => (
          <Column
            key={c.column}
            board={board}
            {...c}
            className={c.column === mobileColumn ? '' : 'max-md:hidden'}
          />
        ))}
        <Strings />
      </div>

      <DragOverlay dropAnimation={null} className="opacity-90">
        {overlay}
      </DragOverlay>
    </DndContext>
  )
}

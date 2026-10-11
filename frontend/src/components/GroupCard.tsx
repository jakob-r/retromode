import { useDraggable, useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Layers, Pencil, Rocket, ThumbsUp, Ungroup } from 'lucide-react'
import { useState } from 'react'
import { COLUMNS, LIMITS, type PublicGroup, type PublicItem } from '@retromode/shared'
import { COLUMN_META } from '../lib/columns'
import * as model from '../lib/model'
import { softSpring, spring } from '../lib/motion'
import { actions } from '../store/board'
import { useDrag, useDropMode } from '../store/drag'
import { useUi } from '../store/ui'
import { DropIndicator } from './DropIndicator'
import { ItemCard } from './ItemCard'
import { Menu, type MenuEntry } from './Menu'
import { stringAnchor } from './Strings'
import { TieBadge } from './TieBadge'

interface Props {
  group: PublicGroup
  items: PublicItem[]
  votes: number
  canVote: boolean
  locked: boolean
  isOwner: boolean
  overlay?: boolean
}

export function GroupCard({
  group,
  items,
  votes,
  canVote,
  locked,
  isOwner,
  overlay = false,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false)
  const dropMode = useDropMode(`group:${group.id}`)
  const draggingSelf = useDrag((s) => s.active?.type === 'group' && s.active.id === group.id)

  const drag = useDraggable({
    id: `group:${group.id}`,
    data: { type: 'group', id: group.id },
    disabled: locked || editingTitle || overlay,
  })
  const drop = useDroppable({
    id: `drop-group:${group.id}`,
    data: { kind: 'group', id: group.id, column: group.column },
    disabled: overlay || draggingSelf,
  })

  const menu: MenuEntry[] = []
  if (!locked) {
    menu.push(
      { label: 'Rename', icon: <Pencil size={15} />, onSelect: () => setEditingTitle(true) },
      {
        label: 'Merge with…',
        icon: <Layers size={15} />,
        onSelect: () => useUi.getState().setMergeSource({ type: 'group', id: group.id }),
      },
      { label: 'Ungroup', icon: <Ungroup size={15} />, onSelect: () => actions.ungroup(group.id) },
    )
    if (group.column === model.LINK_TARGET) {
      menu.push({
        label: 'Add action item',
        icon: <Rocket size={15} />,
        onSelect: () => useUi.getState().setActionFor({ type: 'group', id: group.id }),
      })
    }
    for (const column of COLUMNS) {
      if (column === group.column) continue
      menu.push({
        label: `Move to ${COLUMN_META[column].title}`,
        icon: <ArrowRight size={15} />,
        onSelect: () => actions.moveGroup(group.id, column, null),
      })
    }
  }

  return (
    <div className="entry relative">
      <DropIndicator mode={dropMode} />
      {dropMode === 'link' && <TieBadge />}
      <motion.div
        ref={(node) => {
          drag.setNodeRef(node)
          drop.setNodeRef(node)
        }}
        {...stringAnchor({ type: 'group', id: group.id }, overlay)}
        animate={{
          scale: dropMode === 'merge' || dropMode === 'link' ? 1.02 : 1,
          rotate: overlay ? 1.5 : 0,
        }}
        transition={softSpring}
        className={`relative rounded-3xl bg-[color-mix(in_srgb,var(--accent)_16%,white)] p-2 pt-0 shadow-[0_2px_0_rgba(43,33,64,0.05),4px_4px_0_-1px_color-mix(in_srgb,var(--accent)_25%,white),8px_8px_0_-2px_color-mix(in_srgb,var(--accent)_12%,white)] transition-opacity ${
          drag.isDragging ? 'opacity-35' : ''
        } ${dropMode === 'merge' ? 'accent-ring' : ''} ${dropMode === 'link' ? 'tie-ring' : ''} ${overlay ? 'shadow-2xl' : ''}`}
      >
        <div
          {...drag.attributes}
          {...drag.listeners}
          className={`flex items-center gap-2 px-2 pt-2.5 pb-2 ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
        >
          <Layers size={15} className="shrink-0 text-[var(--accent-deep)]" />
          {editingTitle ? (
            <TitleInput
              initial={group.title ?? ''}
              onDone={(title) => {
                setEditingTitle(false)
                if (title !== undefined && title !== (group.title ?? '')) {
                  actions.renameGroup(group.id, title || null)
                }
              }}
            />
          ) : (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => !locked && setEditingTitle(true)}
              className={`min-w-0 flex-1 truncate text-left font-display text-[15px] font-bold text-[var(--accent-deep)] ${
                group.title ? '' : 'italic opacity-70'
              }`}
              title={locked ? undefined : 'Click to name this group'}
            >
              {group.title || 'Unnamed group'}
            </button>
          )}
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-[var(--accent-deep)] tabular-nums"
            title="Total votes in this group"
          >
            <ThumbsUp size={12} strokeWidth={2.5} /> {votes}
          </span>
          {!overlay && <Menu entries={menu} label="Group actions" />}
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                className="entry"
                layout="position"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={spring}
              >
                <ItemCard
                  item={item}
                  canVote={canVote}
                  locked={locked}
                  isOwner={isOwner}
                  overlay={overlay}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

function TitleInput({ initial, onDone }: { initial: string; onDone: (title?: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <input
      autoFocus
      value={value}
      maxLength={LIMITS.groupTitle}
      placeholder="Name this group"
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value.trim())
        if (e.key === 'Escape') onDone(undefined)
      }}
      className="min-w-0 flex-1 rounded-lg bg-white px-2 py-0.5 font-display text-[15px] font-bold text-[var(--accent-deep)] outline-none ring-2 ring-[var(--accent)]"
    />
  )
}

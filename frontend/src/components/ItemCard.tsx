import { useDraggable, useDroppable } from '@dnd-kit/core'
import { motion } from 'motion/react'
import { ArrowRight, Layers, LogOut, Pencil, Rocket, Scissors, Spline, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { COLUMNS, LIMITS, type PublicItem } from '@retromode/shared'
import { COLUMN_META } from '../lib/columns'
import * as model from '../lib/model'
import { softSpring } from '../lib/motion'
import { actions, useBoard } from '../store/board'
import { useDrag, useDropMode } from '../store/drag'
import { useMe } from '../store/me'
import { useUi } from '../store/ui'
import { AnonymityToggle } from './AnonymityToggle'
import { DropIndicator } from './DropIndicator'
import { EmojiBurst } from './EmojiBurst'
import { Menu, type MenuEntry } from './Menu'
import { Obscured, useItemsHidden } from './Obscured'
import { stringAnchor } from './Strings'
import { TieBadge } from './TieBadge'
import { VoteButton } from './VoteButton'

interface Props {
  item: PublicItem
  canVote: boolean
  locked: boolean
  isOwner: boolean
  /** Static copy rendered inside the DragOverlay */
  overlay?: boolean
}

export function ItemCard({ item, canVote, locked, isOwner, overlay = false }: Props) {
  const [editing, setEditing] = useState(false)
  const activeGroup = useDrag((s) => (s.active?.type === 'group' ? s.active.id : null))
  const remote = useBoard((s) => !!s.remoteArrivals[item.id])
  const fresh = useBoard((s) => !!s.freshItems[item.id])
  const dropMode = useDropMode(`item:${item.id}`)
  const hidden = useItemsHidden() && !item.mine
  const tiedTo = useBoard((s) =>
    item.link ? model.entryLabel({ items: s.items, groups: s.groups }, item.link) : null,
  )

  const drag = useDraggable({
    id: `item:${item.id}`,
    data: { type: 'item', id: item.id },
    disabled: locked || editing || overlay,
  })
  const drop = useDroppable({
    id: `drop-item:${item.id}`,
    data: { kind: 'item', id: item.id, groupId: item.groupId, column: item.column },
    // Can't drop onto yourself, or a dragged group onto its own items
    disabled: overlay || drag.isDragging || (!!item.groupId && activeGroup === item.groupId),
  })

  const menu: MenuEntry[] = []
  if (!locked) {
    if (item.mine)
      menu.push({ label: 'Edit', icon: <Pencil size={15} />, onSelect: () => setEditing(true) })
    menu.push({
      label: 'Merge with…',
      icon: <Layers size={15} />,
      onSelect: () => useUi.getState().setMergeSource({ type: 'item', id: item.id }),
    })
    if (item.column === model.LINK_TARGET) {
      menu.push({
        label: 'Add action item',
        icon: <Rocket size={15} />,
        onSelect: () => useUi.getState().setActionFor({ type: 'item', id: item.id }),
      })
    }
    if (item.column === model.LINK_SOURCE) {
      menu.push({
        label: item.link ? 'Tie to something else…' : 'Tie to…',
        icon: <Spline size={15} />,
        onSelect: () => useUi.getState().setLinkSource(item.id),
      })
      if (item.link) {
        menu.push({
          label: 'Cut the string',
          icon: <Scissors size={15} />,
          onSelect: () => actions.link(item.id, null),
        })
      }
    }
    if (item.groupId) {
      menu.push({
        label: 'Take out of group',
        icon: <LogOut size={15} />,
        onSelect: () => actions.moveItem(item.id, item.column, null, item.groupId),
      })
    }
    for (const column of COLUMNS) {
      if (column === item.column) continue
      menu.push({
        label: `Move to ${COLUMN_META[column].title}`,
        icon: <ArrowRight size={15} />,
        onSelect: () => actions.moveItem(item.id, column, null, null),
      })
    }
    if (item.mine || isOwner) {
      menu.push({
        label: 'Delete',
        icon: <Trash2 size={15} />,
        danger: true,
        onSelect: () => actions.deleteItem(item.id),
      })
    }
  }

  if (editing) return <EditItem item={item} onDone={() => setEditing(false)} />

  return (
    <div className="entry relative">
      <DropIndicator mode={dropMode} />
      {dropMode === 'link' && <TieBadge />}
      {fresh && !overlay && <EmojiBurst itemId={item.id} column={item.column} />}
      <motion.div
        ref={(node) => {
          drag.setNodeRef(node)
          drop.setNodeRef(node)
        }}
        {...drag.attributes}
        {...drag.listeners}
        {...stringAnchor({ type: 'item', id: item.id }, overlay)}
        animate={
          dropMode === 'merge'
            ? { scale: 1.03, rotate: [0, -1.2, 1.2, 0] }
            : { scale: dropMode === 'link' ? 1.03 : 1, rotate: overlay ? 2.5 : 0 }
        }
        transition={
          dropMode === 'merge'
            ? { rotate: { repeat: Infinity, duration: 0.5 }, scale: softSpring }
            : softSpring
        }
        className={`group/card relative rounded-2xl bg-white pl-4 pr-2.5 pt-2.5 pb-2 shadow-[0_2px_0_rgba(43,33,64,0.06),0_8px_24px_-12px_color-mix(in_srgb,var(--accent)_60%,transparent)] transition-[opacity,box-shadow] ${
          drag.isDragging ? 'opacity-35' : ''
        } ${dropMode === 'merge' ? 'accent-ring' : ''} ${dropMode === 'link' ? 'tie-ring' : ''} ${overlay ? 'cursor-grabbing shadow-2xl' : locked ? '' : 'cursor-grab'} ${
          remote ? 'remote-glow' : ''
        }`}
      >
        <span
          className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-[var(--accent)]"
          aria-hidden
        />
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 py-0.5 text-[15px] leading-snug break-words whitespace-pre-wrap">
            {hidden ? <Obscured text={item.text} seed={item.id} /> : item.text}
          </p>
          {!overlay && <Menu entries={menu} label="Item actions" />}
        </div>
        {/* On mobile only one column shows at a time, so strings can't be drawn */}
        {tiedTo && (
          <p className="mt-1.5 truncate text-xs font-medium text-coral-deep md:hidden">
            🧶 {hidden ? <Obscured text={tiedTo} seed={`${item.id}:tie`} /> : tiedTo}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-ink-soft">
            {item.nickname ? `👤 ${item.nickname}` : '🥷 Anonymous'}
            {item.mine && <span className="ml-1 text-[var(--accent-deep)] opacity-80">(you)</span>}
          </span>
          <VoteButton item={item} canVote={canVote} locked={locked || overlay} />
        </div>
      </motion.div>
    </div>
  )
}

function EditItem({ item, onDone }: { item: PublicItem; onDone: () => void }) {
  const nickname = useMe((s) => s.nickname)
  const [text, setText] = useState(item.text)
  const [anonymous, setAnonymous] = useState(item.nickname === null)

  const save = () => {
    const value = text.trim()
    if (!value) return
    actions.updateItem(item.id, value, anonymous, item.nickname ?? nickname)
    onDone()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onDone()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      save()
    }
  }

  return (
    <div className="accent-ring rounded-2xl bg-white p-2.5">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={LIMITS.itemText}
        aria-label="Edit item"
        className="field-sizing-content block max-h-60 min-h-12 w-full resize-none bg-transparent px-1.5 py-1 text-[15px] leading-snug outline-none"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <AnonymityToggle anonymous={anonymous} onChange={setAnonymous} />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onDone}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!text.trim()}
            className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

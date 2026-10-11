import { useDroppable } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import type { ColumnKey, PublicBoard } from '@retromode/shared'
import { accentVars, COLUMN_META } from '../lib/columns'
import type { Entry } from '../lib/model'
import { spring } from '../lib/motion'
import { useDropMode } from '../store/drag'
import { AddItemForm } from './AddItemForm'
import { DropIndicator } from './DropIndicator'
import { GroupCard } from './GroupCard'
import { ItemCard } from './ItemCard'
import { VoteBudget } from './VoteBudget'

interface Props {
  column: ColumnKey
  board: PublicBoard
  entries: Entry[]
  count: number
  used: number
  className?: string
}

export function Column({ column, board, entries, count, used, className = '' }: Props) {
  const meta = COLUMN_META[column]
  const canVote = used < board.voteLimit
  const endMode = useDropMode(`column:${column}`)
  const { setNodeRef } = useDroppable({
    id: `drop-column:${column}`,
    data: { kind: 'column', column },
  })

  return (
    <section
      style={accentVars(column)}
      aria-label={meta.title}
      className={`flex min-h-0 flex-col rounded-[2rem] bg-[color-mix(in_srgb,var(--accent-tint)_70%,transparent)] p-3 ring-1 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)] backdrop-blur-sm sm:p-4 ${className}`}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-[var(--accent-deep)]">
          <motion.span
            className="inline-block"
            whileHover={{ rotate: [0, -15, 15, 0], scale: 1.2 }}
            transition={{ duration: 0.5 }}
          >
            {meta.emoji}
          </motion.span>
          {meta.title}
          <span className="rounded-full bg-white/70 px-2 py-0.5 font-sans text-xs font-bold tabular-nums">
            {count}
          </span>
        </h2>
        {!board.locked && <VoteBudget used={used} limit={board.voteLimit} />}
      </header>

      {!board.locked && <AddItemForm column={column} />}

      <div ref={setNodeRef} className="relative mt-3 flex min-h-32 flex-1 flex-col gap-3 pb-6">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              className="entry"
              layout="position"
              initial={{ opacity: 0, scale: 0.85, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.18 } }}
              transition={spring}
            >
              {entry.type === 'item' ? (
                <ItemCard
                  item={entry.item}
                  canVote={canVote}
                  locked={board.locked}
                  isOwner={board.isOwner}
                />
              ) : (
                <GroupCard
                  group={entry.group}
                  items={entry.items}
                  votes={entry.votes}
                  canVote={canVote}
                  locked={board.locked}
                  isOwner={board.isOwner}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--accent-deep)] opacity-50">
            {board.locked ? 'Nothing here.' : 'Nothing yet – be the first ✨'}
          </p>
        )}
        <div className="relative">
          <DropIndicator mode={endMode} />
        </div>
      </div>
    </section>
  )
}

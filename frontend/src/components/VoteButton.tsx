import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import type { PublicItem } from '@retromode/shared'
import { actions } from '../store/board'
import { SparkleBurst } from './Sparkles'

export function VoteButton({
  item,
  canVote,
  locked,
}: {
  item: PublicItem
  canVote: boolean
  locked: boolean
}) {
  const [burst, setBurst] = useState(0)
  const [scope, animate] = useAnimate()
  const voted = item.myVotes > 0
  const disabled = locked || !canVote

  const onClick = () => {
    if (!actions.addVote(item.id)) {
      void animate(scope.current, { x: [0, -4, 4, -2, 0] }, { duration: 0.35 })
      return
    }
    setBurst((b) => b + 1)
    void animate(
      scope.current,
      { scale: [1, 1.35, 0.9, 1], rotate: [0, -14, 6, 0] },
      { duration: 0.45 },
    )
  }

  const label = `${item.votes} ${item.votes === 1 ? 'vote' : 'votes'}${voted ? `, ${item.myVotes} from you` : ''}`

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClick}
        disabled={locked}
        aria-pressed={voted}
        aria-label={`Vote (${label})`}
        title={disabled && !locked ? 'No votes left in this column' : label}
        className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold transition-colors ${
          voted
            ? 'bg-[var(--accent)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--accent)_40%,transparent)]'
            : disabled
              ? 'bg-black/[0.03] text-ink-soft/50'
              : 'bg-[var(--accent-tint)] text-[var(--accent-deep)] hover:brightness-95'
        } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <SparkleBurst trigger={burst} />
        <span ref={scope} className="inline-flex">
          <ThumbsUp size={14} strokeWidth={2.5} fill={voted ? 'currentColor' : 'none'} />
        </span>
        <span className="relative inline-flex h-5 min-w-[1ch] items-center overflow-hidden tabular-nums">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={item.votes}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {item.votes}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {voted && !locked && (
          <motion.button
            type="button"
            initial={{ scale: 0, opacity: 0, width: 0 }}
            animate={{ scale: 1, opacity: 1, width: 'auto' }}
            exit={{ scale: 0, opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => actions.removeVote(item.id)}
            aria-label={`Take back one of your votes (${item.myVotes} from you)`}
            title="Take back one of your votes"
            className="flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--accent-tint)] p-1.5 text-[var(--accent-deep)] transition-colors hover:brightness-95"
          >
            <ThumbsDown size={14} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { ThumbsUp } from 'lucide-react'
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
  const disabled = locked || (!item.votedByMe && !canVote)

  const onClick = () => {
    const adding = !item.votedByMe
    if (!actions.toggleVote(item.id)) {
      void animate(scope.current, { x: [0, -4, 4, -2, 0] }, { duration: 0.35 })
      return
    }
    if (adding) {
      setBurst((b) => b + 1)
      void animate(
        scope.current,
        { scale: [1, 1.35, 0.9, 1], rotate: [0, -14, 6, 0] },
        { duration: 0.45 },
      )
    }
  }

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      disabled={locked}
      aria-pressed={item.votedByMe}
      aria-label={`${item.votedByMe ? 'Remove your vote' : 'Vote'} (${item.votes} ${item.votes === 1 ? 'vote' : 'votes'})`}
      title={disabled && !locked ? 'No votes left in this column' : undefined}
      className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold transition-colors ${
        item.votedByMe
          ? 'bg-[var(--accent)] text-white shadow-sm shadow-[color-mix(in_srgb,var(--accent)_40%,transparent)]'
          : disabled
            ? 'bg-black/[0.03] text-ink-soft/50'
            : 'bg-[var(--accent-tint)] text-[var(--accent-deep)] hover:brightness-95'
      } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <SparkleBurst trigger={burst} />
      <span ref={scope} className="inline-flex">
        <ThumbsUp size={14} strokeWidth={2.5} fill={item.votedByMe ? 'currentColor' : 'none'} />
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
  )
}

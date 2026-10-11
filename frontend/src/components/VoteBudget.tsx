import { motion, useAnimate } from 'motion/react'
import { useEffect, useRef } from 'react'

/** Dots for the votes you have left in a column; waves when the last one is spent. */
export function VoteBudget({ used, limit }: { used: number; limit: number }) {
  const left = Math.max(0, limit - used)
  const [scope, animate] = useAnimate()
  const previous = useRef(left)

  useEffect(() => {
    if (previous.current > 0 && left === 0 && scope.current) {
      void animate('span[data-dot]', { y: [0, -5, 0] }, { duration: 0.4, delay: (i) => i * 0.06 })
    }
    previous.current = left
  }, [left, animate, scope])

  return (
    <div
      className="flex items-center gap-2 text-xs font-medium text-[var(--accent-deep)]"
      title={`You have ${left} of ${limit} votes left in this column`}
    >
      <div ref={scope} className="flex flex-wrap items-center gap-1" aria-hidden>
        {Array.from({ length: limit }, (_, i) => (
          <motion.span
            data-dot
            key={i}
            layout
            className={`block h-2 w-2 rounded-full transition-colors duration-300 ${
              i < left
                ? 'bg-[var(--accent)]'
                : 'border border-[var(--accent)] bg-transparent opacity-50'
            }`}
          />
        ))}
      </div>
      <span className="whitespace-nowrap">
        {left} {left === 1 ? 'vote' : 'votes'} left
      </span>
    </div>
  )
}

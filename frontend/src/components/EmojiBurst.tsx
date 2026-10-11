import { motion } from 'motion/react'
import { useMemo } from 'react'
import type { ColumnKey } from '@retromode/shared'
import { hash, pickEmoji } from '../lib/emoji'
import { prefersReducedMotion } from '../lib/motion'

/** A fountain of one emoji over a freshly created item (positive or negative column). */
export function EmojiBurst({ itemId, column }: { itemId: string; column: ColumnKey }) {
  return <EmojiFountain emoji={pickEmoji(column, itemId)} seed={hash(itemId)} />
}

/** Sprays `count` copies of one emoji upwards from the middle of the parent. */
export function EmojiFountain({
  emoji,
  seed: initialSeed,
  count = 10,
  spread = 1,
}: {
  emoji: string | null
  seed: number
  count?: number
  /** Scales how far the particles fly */
  spread?: number
}) {
  const particles = useMemo(() => {
    let seed = initialSeed || 1
    const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 1000) / 1000
    return Array.from({ length: count }, (_, i) => {
      const angle =
        (-90 + (i - (count - 1) / 2) * (160 / count) + (rand() - 0.5) * 12) * (Math.PI / 180)
      const distance = (50 + rand() * 50) * spread
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: (16 + rand() * 12) * Math.sqrt(spread),
        rotate: (rand() - 0.5) * 120,
        delay: rand() * 0.15,
      }
    })
  }, [initialSeed, count, spread])

  if (!emoji || prefersReducedMotion()) return null

  return (
    <span className="pointer-events-none absolute inset-0 z-30 overflow-visible" aria-hidden>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 leading-none select-none"
          style={{ fontSize: p.size }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: [0, p.y, p.y + 30],
            scale: [0, 1.2, 0.9],
            opacity: [1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut', times: [0, 0.55, 1] }}
        >
          {emoji}
        </motion.span>
      ))}
    </span>
  )
}

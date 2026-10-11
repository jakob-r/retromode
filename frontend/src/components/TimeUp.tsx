import { motion } from 'motion/react'
import { useMemo } from 'react'
import { prefersReducedMotion } from '../lib/motion'

const EMOJIS = ['⏰', '⏱️', '⌛', '⏳', '🕰️', '🔔', '⏲️', '🕛']
const COUNT = 36

/** Darkens the backdrop while the timer runs, so the board feels like focus time. */
export function FocusDim({ active }: { active: boolean }) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 -z-[5] bg-ink"
      initial={false}
      animate={{ opacity: active ? 0.55 : 0 }}
      transition={{ duration: active ? 2.5 : 1.2, ease: 'easeInOut' }}
      aria-hidden
    />
  )
}

/** A burst of clocks and hourglasses from the middle of the screen when the timer runs out. */
export function TimeUpBurst({ seed }: { seed: number }) {
  const particles = useMemo(() => {
    let s = (seed * 2654435761) >>> 0 || 1
    const rand = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0) % 1000) / 1000
    return Array.from({ length: COUNT }, (_, i) => {
      const angle = ((i / COUNT) * 360 + (rand() - 0.5) * 20) * (Math.PI / 180)
      const distance = 160 + rand() * 260
      return {
        emoji: EMOJIS[Math.floor(rand() * EMOJIS.length)]!,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 22 + rand() * 22,
        rotate: (rand() - 0.5) * 240,
        delay: rand() * 0.25,
      }
    })
  }, [seed])

  if (prefersReducedMotion()) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 leading-none select-none"
          style={{ fontSize: p.size }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: p.x,
            y: [0, p.y, p.y + 80],
            scale: [0, 1.3, 0.9],
            opacity: [1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{ duration: 1.8, delay: p.delay, ease: 'easeOut', times: [0, 0.5, 1] }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  )
}

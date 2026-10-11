import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

export function SparkleShape({ size = 12, color = 'var(--color-sunny)', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 0c1.2 6.6 3.4 9.4 12 12-8.6 2.6-10.8 5.4-12 12C10.8 17.4 8.6 14.6 0 12 8.6 9.4 10.8 6.6 12 0z"
        fill={color}
      />
    </svg>
  )
}

/** A sparkle that twinkles forever (decoration). */
export function Twinkle({
  size = 14,
  delay = 0,
  color,
  className = '',
}: {
  size?: number
  delay?: number
  color?: string
  className?: string
}) {
  return (
    <span
      className={`pointer-events-none inline-block animate-twinkle ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <SparkleShape size={size} color={color} />
    </span>
  )
}

const BURST_COLORS = ['var(--color-sunny)', 'var(--accent, var(--color-violet))', '#fff']

/** Little sparkles flying out whenever `trigger` changes (and is > 0). */
export function SparkleBurst({ trigger, count = 6 }: { trigger: number; count?: number }) {
  const [bursts, setBursts] = useState<number[]>([])

  useEffect(() => {
    if (trigger === 0 || prefersReducedMotion()) return
    setBursts((b) => [...b, trigger])
    const t = setTimeout(() => setBursts((b) => b.filter((x) => x !== trigger)), 900)
    return () => clearTimeout(t)
  }, [trigger])

  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <AnimatePresence>
        {bursts.map((id) =>
          Array.from({ length: count }, (_, i) => {
            const angle = (-90 + (i - (count - 1) / 2) * (150 / count)) * (Math.PI / 180)
            const distance = 26 + (i % 3) * 8
            return (
              <motion.span
                key={`${id}-${i}`}
                className="absolute top-1/2 left-1/2"
                initial={{ x: -6, y: -6, scale: 0, opacity: 1, rotate: 0 }}
                animate={{
                  x: Math.cos(angle) * distance - 6,
                  y: Math.sin(angle) * distance - 6,
                  scale: [0, 1.1, 0],
                  opacity: [1, 1, 0],
                  rotate: 90,
                }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              >
                <SparkleShape
                  size={i % 2 ? 10 : 13}
                  color={BURST_COLORS[i % BURST_COLORS.length]}
                />
              </motion.span>
            )
          }),
        )}
      </AnimatePresence>
    </span>
  )
}

import { motion } from 'motion/react'
import type { DropMode } from '../store/drag'

/** Glowing insertion line shown above/below an entry while dragging. */
export function DropIndicator({ mode }: { mode: DropMode | null }) {
  if (mode !== 'before' && mode !== 'after' && mode !== 'end') return null
  return (
    <motion.div
      layoutId="drop-indicator"
      className={`pointer-events-none absolute inset-x-1 z-20 h-1 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)] ${
        mode === 'before' ? '-top-2' : '-bottom-2'
      }`}
      transition={{ type: 'spring', stiffness: 600, damping: 40 }}
    />
  )
}

import { motion } from 'motion/react'

/** Floats over a drop target that would tie an action item to something to improve. */
export function TieBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, y: 4, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="pointer-events-none absolute -top-3 right-3 z-30 rounded-full bg-violet px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-white shadow-md"
    >
      🧶 Tie together
    </motion.span>
  )
}

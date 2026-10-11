import { AnimatePresence, motion } from 'motion/react'
import { useToasts } from '../store/toasts'
import { spring } from '../lib/motion'

const TONES = {
  info: 'bg-ink text-white',
  success: 'bg-mint-deep text-white',
  error: 'bg-coral-deep text-white animate-wobble',
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.95 }}
            transition={spring}
            className={`rounded-full px-4 py-2 text-sm font-medium shadow-lg ${TONES[t.tone]}`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

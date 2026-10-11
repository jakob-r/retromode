import { AnimatePresence, motion } from 'motion/react'
import { Lock } from 'lucide-react'

export function LockBanner({ locked, isOwner }: { locked: boolean; isOwner: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {locked && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white">
            <motion.span
              initial={{ rotate: -30, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 12, delay: 0.1 }}
              className="rounded-full bg-sunny p-1.5 text-ink"
            >
              <Lock size={16} />
            </motion.span>
            <p className="text-sm">
              <strong className="font-semibold">This board is locked.</strong>{' '}
              <span className="text-white/75">
                It's read-only now{isOwner ? ' – unlock it in the settings.' : '.'}
              </span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

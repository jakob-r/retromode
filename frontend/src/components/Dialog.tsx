import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { spring } from '../lib/motion'

export function Dialog({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  dismissible?: boolean
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open || !dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl bg-paper p-6 shadow-2xl shadow-ink/20"
            initial={{ y: 40, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.96, opacity: 0 }}
            transition={spring}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight">
                {title}
              </h2>
              {dismissible && (
                <button
                  onClick={onClose}
                  className="-m-1 rounded-full p-1.5 text-ink-soft transition hover:bg-line/60 hover:text-ink"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

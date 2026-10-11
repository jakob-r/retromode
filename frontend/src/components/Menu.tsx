import { AnimatePresence, motion } from 'motion/react'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuEntry {
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
}

/** A small "⋯" popover menu. Stops pointer events so it never starts a drag. */
export function Menu({
  entries,
  label = 'More actions',
}: {
  entries: MenuEntry[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (entries.length === 0) return null
  return (
    <div ref={ref} className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1 text-ink-soft transition hover:bg-black/5 hover:text-ink"
      >
        <MoreHorizontal size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full right-0 z-30 mt-1 min-w-52 origin-top-right whitespace-nowrap rounded-2xl border border-line bg-paper p-1.5 shadow-xl shadow-ink/10"
          >
            {entries.map((entry, i) => (
              <button
                key={i}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  entry.onSelect()
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-black/5 ${
                  entry.danger ? 'text-coral-deep' : 'text-ink'
                }`}
              >
                {entry.icon && <span className="shrink-0 opacity-70">{entry.icon}</span>}
                {entry.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

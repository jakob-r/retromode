import { AnimatePresence, motion } from 'motion/react'
import { Lock, LockOpen, Minus, Plus, Radiation, Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LIMITS, type PublicBoard } from '@retromode/shared'
import { actions } from '../store/board'
import { CopyField } from './CopyField'
import { NukeDialog } from './NukeDialog'
import { adminUrl } from './ShareDialog'

/** Owner-only board settings: title, votes per column, lock, nuke. */
export function SettingsPopover({ board }: { board: PublicBoard }) {
  const [open, setOpen] = useState(false)
  const [nukeOpen, setNukeOpen] = useState(false)
  const [title, setTitle] = useState(board.title)
  const ref = useRef<HTMLDivElement>(null)
  const admin = adminUrl(board.slug)

  useEffect(() => setTitle(board.title), [board.title])
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const saveTitle = () => {
    const value = title.trim()
    if (value && value !== board.title) actions.updateSettings({ title: value })
    else setTitle(board.title)
  }
  const setLimit = (voteLimit: number) => {
    if (voteLimit >= LIMITS.voteLimitMin && voteLimit <= LIMITS.voteLimitMax) {
      actions.updateSettings({ voteLimit })
    }
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: open ? 60 : 0 }}
        aria-label="Board settings"
        aria-expanded={open}
        className="header-control rounded-full bg-white/80 p-2.5 text-ink shadow-sm transition hover:bg-white"
      >
        <Settings size={18} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right rounded-3xl border border-line bg-paper p-5 text-ink shadow-2xl shadow-ink/15"
          >
            <h3 className="mb-4 font-display text-lg font-bold">Board settings</h3>

            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Title
            </label>
            <input
              value={title}
              disabled={board.locked}
              maxLength={LIMITS.boardTitle}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="mb-4 w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-violet disabled:opacity-50"
            />

            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Votes per person</p>
                <p className="text-xs text-ink-soft">in each column</p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-black/[0.04] p-1">
                <button
                  type="button"
                  aria-label="Fewer votes"
                  disabled={board.locked || board.voteLimit <= LIMITS.voteLimitMin}
                  onClick={() => setLimit(board.voteLimit - 1)}
                  className="rounded-full bg-white p-1.5 shadow-sm disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-display text-lg font-bold tabular-nums">
                  {board.voteLimit}
                </span>
                <button
                  type="button"
                  aria-label="More votes"
                  disabled={board.locked || board.voteLimit >= LIMITS.voteLimitMax}
                  onClick={() => setLimit(board.voteLimit + 1)}
                  className="rounded-full bg-white p-1.5 shadow-sm disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={board.locked}
              onClick={() => actions.updateSettings({ locked: !board.locked })}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition ${
                board.locked ? 'bg-ink text-white' : 'bg-black/[0.04] hover:bg-black/[0.07]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <motion.span
                  key={String(board.locked)}
                  initial={{ rotate: -25, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  {board.locked ? <Lock size={18} /> : <LockOpen size={18} />}
                </motion.span>
                <span>
                  <span className="block text-sm font-semibold">
                    {board.locked ? 'Board is locked' : 'Lock board'}
                  </span>
                  <span
                    className={`block text-xs ${board.locked ? 'text-white/70' : 'text-ink-soft'}`}
                  >
                    {board.locked
                      ? 'Read-only for everyone. Click to unlock.'
                      : 'Make it read-only when you are done'}
                  </span>
                </span>
              </span>
              <span
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                  board.locked ? 'bg-sunny' : 'bg-black/15'
                }`}
              >
                <motion.span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                  animate={{ left: board.locked ? 18 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
            </button>

            {admin && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                  Admin link (keep it private)
                </p>
                <CopyField value={admin} label="Admin link" />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setNukeOpen(true)
              }}
              className="mt-4 flex w-full items-center gap-2.5 rounded-2xl border border-coral/40 p-3 text-left text-coral-deep transition hover:bg-coral-tint"
            >
              <Radiation size={18} />
              <span>
                <span className="block text-sm font-semibold">Nuke board</span>
                <span className="block text-xs text-coral-deep/80">
                  Delete it and all its data for good
                </span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <NukeDialog open={nukeOpen} onClose={() => setNukeOpen(false)} />
    </div>
  )
}

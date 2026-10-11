import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { actions } from '../store/board'
import { Dialog } from './Dialog'

const WORD = 'NUKE'

/** Owner-only: deletes the board for everyone, after typing NUKE. */
export function NukeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const armed = typed === WORD && !busy

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const nuke = async () => {
    if (!armed) return
    setBusy(true)
    const done = await actions.nuke()
    setBusy(false)
    if (done) onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nuke this board? ☢️">
      <p className="mb-2 text-sm text-ink-soft">
        This deletes the board and everything on it – every item, group, vote and action item – for
        everyone, right now. Nothing is archived and it can't be undone.
      </p>
      <p className="mb-4 text-sm text-ink-soft">
        Anyone still on the board gets kicked out and the link stops working.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void nuke()
        }}
      >
        <label htmlFor="nuke-confirm" className="mb-1.5 block text-sm font-semibold">
          Type <span className="font-mono text-coral-deep">{WORD}</span> to confirm
        </label>
        <input
          id="nuke-confirm"
          value={typed}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
          className="mb-4 w-full rounded-xl border border-line bg-white px-3 py-2 font-mono tracking-widest outline-none focus:border-coral"
        />
        <motion.button
          type="submit"
          disabled={!armed}
          whileTap={armed ? { scale: 0.96 } : undefined}
          className="w-full rounded-2xl bg-coral-deep py-3 font-display text-base font-bold text-white transition hover:bg-coral-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Nuking…' : '💥 Nuke it'}
        </motion.button>
      </form>
    </Dialog>
  )
}

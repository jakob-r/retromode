import { AnimatePresence, motion } from 'motion/react'
import { Check, Hand } from 'lucide-react'
import { actions, useBoard } from '../store/board'

/** While the timer runs: say you're done. Once everyone here is, the timer stops early. */
export function ReadyButton() {
  const running = useBoard((s) => s.timerEndsAt !== null)
  const meReady = useBoard((s) => !!s.board?.timer?.meReady)
  const ready = useBoard((s) => s.ready)
  const online = useBoard((s) => s.online)
  const count = `${Math.min(ready, online)}/${online}`

  return (
    <AnimatePresence>
      {running && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => actions.setReady(!meReady)}
          aria-pressed={meReady}
          aria-label={`I am ready (${count} ready)`}
          title={
            meReady
              ? "You're ready – click if you need more time"
              : 'Done? Once everyone is ready, the timer stops early'
          }
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold shadow-sm transition sm:px-3 ${
            meReady
              ? 'bg-mint text-ink hover:bg-mint/90'
              : 'header-control bg-white/80 hover:bg-white'
          }`}
        >
          {meReady ? <Check size={15} /> : <Hand size={15} />}
          <span className="max-sm:hidden">{meReady ? 'Ready' : 'I am ready'}</span>
          <span className="tabular-nums opacity-75">{count}</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

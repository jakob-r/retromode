import { AnimatePresence, motion } from 'motion/react'
import { Minus, Play, Plus, RotateCcw, Square, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LIMITS } from '@retromode/shared'
import { actions, useBoard } from '../store/board'

const MIN_MINUTES = 1
const MAX_MINUTES = LIMITS.timerMaxSeconds / 60

function format(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Remaining milliseconds of the shared timer, re-rendering a few times a second while it runs. */
function useRemaining(): number | null {
  const endsAt = useBoard((s) => s.timerEndsAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endsAt])
  return endsAt === null ? null : Math.max(0, endsAt - now)
}

/** A countdown anyone can start for everyone. It locks nothing; it just rings at the end. */
export function TimerControl() {
  const remaining = useRemaining()
  const running = remaining !== null
  const lastSeconds = useBoard((s) => s.board?.timer?.seconds)
  const hidingNow = useBoard((s) => !!s.board?.timer?.hideItems)
  const [hideItems, setHideItems] = useState(false)
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState(LIMITS.defaultTimerSeconds / 60)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lastSeconds) setMinutes(Math.round(lastSeconds / 60) || 1)
  }, [lastSeconds])

  useEffect(() => {
    if (running) setHideItems(hidingNow)
  }, [running, hidingNow])

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

  const start = () => {
    actions.setTimer(minutes * 60, hideItems)
    setOpen(false)
  }
  const stop = () => {
    actions.setTimer(null)
    setOpen(false)
  }
  const step = (delta: number) =>
    setMinutes((m) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m + delta)))

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={running ? `Timer: ${format(remaining)} left` : 'Timer'}
        title={running ? 'Timer running for everyone' : 'Start a timer for everyone'}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold shadow-sm transition sm:px-3 ${
          running ? 'bg-sunny text-ink hover:bg-sunny/90' : 'bg-white/80 hover:bg-white'
        }`}
      >
        <motion.span
          className="inline-flex"
          animate={running ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }}
          transition={running ? { duration: 0.6, repeat: Infinity, repeatDelay: 2.4 } : {}}
        >
          <Timer size={15} />
        </motion.span>
        {running ? (
          <span className="tabular-nums">{format(remaining)}</span>
        ) : (
          <span className="max-sm:hidden">Timer</span>
        )}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full right-0 z-40 mt-2 w-[min(17rem,calc(100vw-2rem))] origin-top-right rounded-3xl border border-line bg-paper p-5 text-ink shadow-2xl shadow-ink/15"
          >
            <h3 className="font-display text-lg font-bold">Timer</h3>
            <p className="mb-4 text-xs text-ink-soft">
              Runs for everyone on the board. Nothing gets locked.
            </p>
            {running ? (
              <>
                <p className="mb-4 text-center font-display text-4xl font-bold tabular-nums">
                  {format(remaining)}
                </p>
                {hidingNow && (
                  <p className="-mt-2 mb-4 text-center text-xs text-ink-soft">
                    🙈 Items stay hidden until time's up
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={stop}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold transition hover:bg-cream"
                  >
                    <Square size={14} /> Stop
                  </button>
                  <button
                    type="button"
                    onClick={start}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink/90"
                  >
                    <RotateCcw size={14} /> Restart
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={minutes <= MIN_MINUTES}
                    aria-label="One minute less"
                    className="rounded-full border border-line bg-white p-2 transition hover:bg-cream disabled:opacity-40"
                  >
                    <Minus size={16} />
                  </button>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {minutes} <span className="text-base font-semibold text-ink-soft">min</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={minutes >= MAX_MINUTES}
                    aria-label="One minute more"
                    className="rounded-full border border-line bg-white p-2 transition hover:bg-cream disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-3 transition hover:bg-cream">
                  <input
                    type="checkbox"
                    checked={hideItems}
                    onChange={(e) => setHideItems(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-violet"
                  />
                  <span>
                    <span className="block text-sm font-semibold">🙈 Hide items</span>
                    <span className="block text-xs text-ink-soft">
                      Everyone sees only their own text until time's up – the rest turns into
                      hieroglyphs.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={start}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
                >
                  <Play size={14} /> Start for everyone
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

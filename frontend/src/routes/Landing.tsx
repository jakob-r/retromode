import { motion } from 'motion/react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { LIMITS, type CreateBoardResponse } from '@retromode/shared'
import { COLUMN_META } from '../lib/columns'
import { getClientId, setOwnerKey } from '../lib/identity'
import { toast } from '../store/toasts'
import { Logo } from '../components/Logo'

const features = [
  { emoji: '🔗', text: 'One link, no login' },
  { emoji: '⚡', text: 'Live for everyone' },
  { emoji: '🥷', text: 'Anonymous if you like' },
]

export function Landing() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, clientId: getClientId() }),
      })
      if (!res.ok)
        throw new Error(
          res.status === 429 ? 'Too many boards – try again in a minute' : 'Could not create board',
        )
      const { slug, ownerKey } = (await res.json()) as CreateBoardResponse
      setOwnerKey(slug, ownerKey)
      navigate(`/b/${slug}`, { state: { justCreated: true } })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create board', 'error')
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Logo size="lg" />
      </motion.div>
      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mt-5 max-w-lg text-lg text-balance text-ink-soft sm:text-xl"
      >
        Fast, friendly retro boards for your team. Create one, share the link, and start talking
        about what matters.
      </motion.p>

      <motion.form
        onSubmit={create}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mt-10 flex w-full max-w-xl flex-col gap-2 rounded-[1.75rem] bg-white p-2 shadow-xl shadow-violet/10 ring-1 ring-line sm:flex-row"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LIMITS.boardTitle}
          placeholder="Board title (optional), e.g. Sprint 42"
          aria-label="Board title"
          className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 text-base outline-none placeholder:text-ink-soft/60"
        />
        <motion.button
          type="submit"
          disabled={busy}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-3.5 font-display text-lg font-bold text-white shadow-lg shadow-ink/20 disabled:opacity-70"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : null}
          Create retro board
          {!busy && <ArrowRight size={18} />}
        </motion.button>
      </motion.form>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } } }}
        className="mt-8 flex flex-wrap justify-center gap-2"
      >
        {features.map((f) => (
          <motion.li
            key={f.text}
            variants={{ hidden: { y: 10, opacity: 0 }, show: { y: 0, opacity: 1 } }}
            className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium shadow-sm"
          >
            {f.emoji} {f.text}
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-14 grid w-full max-w-xl grid-cols-3 gap-3" aria-hidden>
        {Object.values(COLUMN_META).map((c, i) => (
          <motion.div
            key={c.key}
            initial={{ y: 30, opacity: 0, rotate: 0 }}
            animate={{ y: 0, opacity: 1, rotate: [-3, 2, -1][i] }}
            transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 200, damping: 15 }}
            whileHover={{ y: -6, rotate: 0 }}
            className="rounded-2xl p-3 text-left shadow-md"
            style={{ background: c.tint }}
          >
            <div className="text-xl">{c.emoji}</div>
            <div
              className="mt-1 font-display text-sm font-bold sm:text-base"
              style={{ color: c.deep }}
            >
              {c.title}
            </div>
            <div
              className="mt-2 h-2 w-4/5 rounded-full opacity-50"
              style={{ background: c.accent }}
            />
            <div
              className="mt-1.5 h-2 w-3/5 rounded-full opacity-30"
              style={{ background: c.accent }}
            />
          </motion.div>
        ))}
      </div>
    </main>
  )
}

import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LIMITS, type ColumnKey } from '@retromode/shared'
import { COLUMN_META } from '../lib/columns'
import { actions } from '../store/board'
import { useMe } from '../store/me'
import { AnonymityToggle } from './AnonymityToggle'

export function AddItemForm({ column }: { column: ColumnKey }) {
  const [text, setText] = useState('')
  const nickname = useMe((s) => s.nickname)
  const anonymous = useMe((s) => s.anonymous)
  const setAnonymous = useMe((s) => s.setAnonymous)
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (!value) return
    actions.createItem(column, value, anonymous ? null : nickname)
    setText('')
    ref.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border-2 border-dashed border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-white/70 p-2.5 transition focus-within:border-solid focus-within:border-[var(--accent)] focus-within:bg-white"
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={LIMITS.itemText}
        rows={2}
        placeholder={COLUMN_META[column].placeholder}
        aria-label={`Add to ${COLUMN_META[column].title}`}
        className="field-sizing-content block max-h-48 min-h-12 w-full resize-none bg-transparent px-1.5 py-1 text-[15px] leading-snug outline-none placeholder:text-ink-soft/60"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <AnonymityToggle anonymous={anonymous} onChange={setAnonymous} />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.9 }}
          disabled={!text.trim()}
          className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition enabled:hover:brightness-105 disabled:opacity-35"
        >
          <Plus size={15} strokeWidth={3} />
          Add
        </motion.button>
      </div>
    </form>
  )
}

import { motion } from 'motion/react'
import { Rocket } from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { LIMITS } from '@retromode/shared'
import { accentVars, COLUMN_META } from '../lib/columns'
import * as model from '../lib/model'
import { actions, useBoard } from '../store/board'
import { useMe } from '../store/me'
import { useUi } from '../store/ui'
import { AnonymityToggle } from './AnonymityToggle'
import { Dialog } from './Dialog'

/** Writes a new action item that hangs on a string from a "To improve" entry. */
export function ActionItemDialog() {
  const target = useUi((s) => s.actionFor)
  const close = () => useUi.getState().setActionFor(null)
  const label = useBoard((s) =>
    target ? model.entryLabel({ items: s.items, groups: s.groups }, target) : null,
  )

  return (
    <Dialog open={!!target} onClose={close} title="New action item">
      {target && (
        <div style={accentVars(model.LINK_SOURCE)}>
          <p className="mb-3 line-clamp-3 rounded-2xl bg-coral-tint px-4 py-2.5 text-sm text-coral-deep">
            🧶 {label}
          </p>
          <ActionItemForm
            onSubmit={(text, anonymous, nickname) => {
              actions.createItem(model.LINK_SOURCE, text, anonymous, nickname, target)
              close()
            }}
          />
        </div>
      )}
    </Dialog>
  )
}

function ActionItemForm({
  onSubmit,
}: {
  onSubmit: (text: string, anonymous: boolean, nickname: string | null) => void
}) {
  const [text, setText] = useState('')
  const nickname = useMe((s) => s.nickname)
  const anonymous = useMe((s) => s.anonymous)
  const setAnonymous = useMe((s) => s.setAnonymous)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const value = text.trim()
    if (value) onSubmit(value, anonymous, nickname)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border-2 border-[var(--accent)] bg-white p-2.5">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={LIMITS.itemText}
        rows={3}
        placeholder={COLUMN_META[model.LINK_SOURCE].placeholder}
        aria-label="Action item"
        className="field-sizing-content block max-h-48 min-h-16 w-full resize-none bg-transparent px-1.5 py-1 text-[15px] leading-snug outline-none placeholder:text-ink-soft/60"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <AnonymityToggle anonymous={anonymous} onChange={setAnonymous} />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.9 }}
          disabled={!text.trim()}
          className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition enabled:hover:brightness-105 disabled:opacity-35"
        >
          <Rocket size={15} strokeWidth={2.5} />
          Add
        </motion.button>
      </div>
    </form>
  )
}

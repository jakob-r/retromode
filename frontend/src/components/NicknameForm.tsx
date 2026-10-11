import { useState, type FormEvent } from 'react'
import { LIMITS } from '@retromode/shared'
import { useMe } from '../store/me'

/** Nickname input with save / stay-anonymous buttons, shared by the nickname and share dialogs. */
export function NicknameForm({
  submitLabel,
  onDone,
}: {
  submitLabel?: string
  onDone: () => void
}) {
  const nickname = useMe((s) => s.nickname)
  const [value, setValue] = useState(nickname ?? '')

  const save = (e: FormEvent) => {
    e.preventDefault()
    useMe.getState().answerNickname(value)
    onDone()
  }

  const skip = () => {
    useMe.getState().answerNickname('')
    onDone()
  }

  return (
    <form onSubmit={save}>
      <p className="mb-3 text-sm text-ink-soft">
        Your nickname is shown on items you post with your name.
      </p>
      <p className="mb-3 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-ink">
        🥷{' '}
        <span className="font-semibold">Setting a name doesn't stop you posting anonymously.</span>{' '}
        Every item has a <span className="font-semibold">Name / Anonymous</span> switch, so you pick
        each time you post.
      </p>
      <input
        autoFocus
        value={value}
        maxLength={LIMITS.nickname}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Kim"
        aria-label="Nickname"
        className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg outline-none transition focus:border-violet"
      />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={!value.trim()}
          className="flex-1 rounded-2xl bg-ink py-3 font-display text-base font-bold text-white transition hover:bg-ink/90 disabled:opacity-40"
        >
          {submitLabel ?? (nickname ? 'Save' : "Let's go")}
        </button>
        <button
          type="button"
          onClick={skip}
          className="flex-1 rounded-2xl py-3 text-sm font-semibold text-ink-soft transition hover:bg-black/5"
        >
          {nickname ? 'Cancel' : 'Skip – stay anonymous 🥷'}
        </button>
      </div>
    </form>
  )
}

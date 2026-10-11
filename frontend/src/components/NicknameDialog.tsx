import { useEffect, useState, type FormEvent } from 'react'
import { LIMITS } from '@retromode/shared'
import { useMe } from '../store/me'
import { Dialog } from './Dialog'

export function NicknameDialog() {
  const open = useMe((s) => s.nicknameDialogOpen)
  const nickname = useMe((s) => s.nickname)
  const [value, setValue] = useState(nickname ?? '')

  useEffect(() => {
    if (open) setValue(useMe.getState().nickname ?? '')
  }, [open])

  const save = (e: FormEvent) => {
    e.preventDefault()
    const { setNickname, setAnonymous, closeNicknameDialog } = useMe.getState()
    setNickname(value)
    if (value.trim()) setAnonymous(false)
    closeNicknameDialog()
  }

  const skip = () => {
    const { setAnonymous, closeNicknameDialog } = useMe.getState()
    if (!nickname) setAnonymous(true)
    closeNicknameDialog()
  }

  return (
    <Dialog
      open={open}
      onClose={skip}
      title={nickname ? 'Change your nickname' : 'What should we call you?'}
    >
      <form onSubmit={save}>
        <p className="mb-3 text-sm text-ink-soft">
          Your nickname is shown on items you post with your name.
        </p>
        <p className="mb-3 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-ink">
          🥷 <span className="font-semibold">Setting a name doesn't stop you posting anonymously.</span>{' '}
          Every item has a <span className="font-semibold">Name / Anonymous</span> switch, so you
          pick each time you post.
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
            {nickname ? 'Save' : "Let's go"}
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
    </Dialog>
  )
}

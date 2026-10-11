import { getOwnerKey } from '../lib/identity'
import { useMe } from '../store/me'
import { CopyField } from './CopyField'
import { Dialog } from './Dialog'
import { NicknameForm } from './NicknameForm'

export function boardUrl(slug: string) {
  return `${window.location.origin}/b/${slug}`
}

export function adminUrl(slug: string): string | null {
  const key = getOwnerKey(slug)
  return key ? `${boardUrl(slug)}?owner=${encodeURIComponent(key)}` : null
}

export function ShareDialog({
  open,
  onClose,
  slug,
  isOwner,
  justCreated,
  askName,
}: {
  open: boolean
  onClose: () => void
  slug: string
  isOwner: boolean
  justCreated: boolean
  /** Also ask the creator for a nickname, so they don't get a second dialog right after */
  askName: boolean
}) {
  const admin = isOwner ? adminUrl(slug) : null
  const dismiss = () => {
    if (askName) useMe.getState().answerNickname('')
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title={justCreated ? 'Your board is ready! 🎉' : 'Invite your team'}
    >
      <p className="mb-3 text-sm text-ink-soft">
        Anyone with this link can join – no login needed.
      </p>
      <CopyField value={boardUrl(slug)} label="Board link" />
      {admin && (
        <div className="mt-5 rounded-2xl bg-sunny-tint p-4">
          <p className="mb-1 text-sm font-semibold">🔑 Save your admin link</p>
          <p className="mb-3 text-xs text-ink-soft">
            You're the owner on this browser. Open this link to manage the board (vote limit, lock)
            from another device. Don't share it.
          </p>
          <CopyField value={admin} label="Admin link" />
        </div>
      )}
      {askName ? (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-2 font-display text-lg font-bold tracking-tight">
            What should we call you?
          </h3>
          <NicknameForm submitLabel="Let's retro ✨" onDone={onClose} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-ink py-3 font-display text-base font-bold text-white transition hover:bg-ink/90"
        >
          {justCreated ? "Let's retro ✨" : 'Done'}
        </button>
      )}
    </Dialog>
  )
}

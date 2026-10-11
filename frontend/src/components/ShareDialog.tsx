import { getOwnerKey } from '../lib/identity'
import { CopyField } from './CopyField'
import { Dialog } from './Dialog'

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
}: {
  open: boolean
  onClose: () => void
  slug: string
  isOwner: boolean
  justCreated: boolean
}) {
  const admin = isOwner ? adminUrl(slug) : null
  return (
    <Dialog
      open={open}
      onClose={onClose}
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
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-2xl bg-ink py-3 font-display text-base font-bold text-white transition hover:bg-ink/90"
      >
        {justCreated ? "Let's retro ✨" : 'Done'}
      </button>
    </Dialog>
  )
}

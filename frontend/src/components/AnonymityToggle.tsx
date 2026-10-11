import { motion } from 'motion/react'
import { useId } from 'react'
import { useMe } from '../store/me'

/** Switches between posting with your nickname and posting anonymously. */
export function AnonymityToggle({
  anonymous,
  onChange,
}: {
  anonymous: boolean
  onChange: (anonymous: boolean) => void
}) {
  const nickname = useMe((s) => s.nickname)
  const openNicknameDialog = useMe((s) => s.openNicknameDialog)
  const effective = anonymous || !nickname
  const pillId = useId()

  const options = [
    { anon: false, label: nickname ? `👤 ${nickname}` : '👤 Name' },
    { anon: true, label: '🥷 Anonymous' },
  ]

  return (
    <div
      className="relative flex rounded-full bg-black/[0.04] p-0.5 text-xs font-medium"
      role="radiogroup"
      aria-label="Post as"
    >
      {options.map((o) => {
        const active = o.anon === effective
        return (
          <button
            key={String(o.anon)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => (!o.anon && !nickname ? openNicknameDialog() : onChange(o.anon))}
            className={`relative max-w-36 truncate rounded-full px-2.5 py-1 transition-colors ${
              active ? 'text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`anon-pill-${pillId}`}
                className="absolute inset-0 rounded-full bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

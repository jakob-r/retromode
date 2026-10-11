import { Layers } from 'lucide-react'
import type { EntryRef } from '@retromode/shared'
import type { Entry } from '../lib/model'

/** A list of column entries to pick one from (merge and tie dialogs). */
export function EntryPicker({
  entries,
  empty,
  selected,
  onPick,
}: {
  entries: Entry[]
  empty: string
  selected?: EntryRef | null
  onPick: (ref: EntryRef) => void
}) {
  return (
    <div className="-mx-2 max-h-[60vh] overflow-y-auto px-2">
      {entries.length === 0 && <p className="py-6 text-center text-sm text-ink-soft">{empty}</p>}
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onPick({ type: entry.type, id: entry.id })}
              aria-current={selected?.id === entry.id || undefined}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-tint)] aria-[current]:border-[var(--accent)] aria-[current]:bg-[var(--accent-tint)]"
            >
              {entry.type === 'item' ? (
                <span className="line-clamp-2">{entry.item.text}</span>
              ) : (
                <span className="flex items-center gap-2 font-semibold text-[var(--accent-deep)]">
                  <Layers size={14} />
                  {entry.group.title || entry.items[0]?.text || 'Group'}
                  <span className="font-normal text-ink-soft">· {entry.items.length} items</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

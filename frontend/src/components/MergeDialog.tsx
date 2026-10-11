import { Layers } from 'lucide-react'
import { useMemo } from 'react'
import type { EntryRef } from '@retromode/shared'
import { accentVars } from '../lib/columns'
import * as model from '../lib/model'
import { actions, useBoard } from '../store/board'
import { useUi } from '../store/ui'
import { Dialog } from './Dialog'

/** Keyboard/touch-friendly alternative to dragging one entry onto another. */
export function MergeDialog() {
  const source = useUi((s) => s.mergeSource)
  const close = () => useUi.getState().setMergeSource(null)
  const items = useBoard((s) => s.items)
  const groups = useBoard((s) => s.groups)

  const { column, candidates } = useMemo(() => {
    if (!source) return { column: null, candidates: [] as model.Entry[] }
    const data = { items, groups }
    const sourceItem = source.type === 'item' ? items[source.id] : undefined
    const col = sourceItem?.column ?? groups[source.id]?.column ?? null
    if (!col) return { column: null, candidates: [] }
    const ownGroup = source.type === 'group' ? source.id : sourceItem?.groupId
    return {
      column: col,
      candidates: model
        .columnEntries(data, col)
        .filter((e) => e.id !== source.id && e.id !== ownGroup),
    }
  }, [source, items, groups])

  const pick = (target: EntryRef) => {
    if (source) actions.merge(source, target)
    close()
  }

  return (
    <Dialog open={!!source} onClose={close} title="Merge with…">
      <div
        style={column ? accentVars(column) : undefined}
        className="-mx-2 max-h-[60vh] overflow-y-auto px-2"
      >
        {candidates.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-soft">
            Nothing else in this column to merge with.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {candidates.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => pick({ type: entry.type, id: entry.id })}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-left text-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]"
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
    </Dialog>
  )
}

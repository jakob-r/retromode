import { useMemo } from 'react'
import type { EntryRef } from '@retromode/shared'
import { accentVars } from '../lib/columns'
import * as model from '../lib/model'
import { actions, useBoard } from '../store/board'
import { useUi } from '../store/ui'
import { Dialog } from './Dialog'
import { EntryPicker } from './EntryPicker'

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
      <div style={column ? accentVars(column) : undefined}>
        <EntryPicker
          entries={candidates}
          empty="Nothing else in this column to merge with."
          onPick={pick}
        />
      </div>
    </Dialog>
  )
}

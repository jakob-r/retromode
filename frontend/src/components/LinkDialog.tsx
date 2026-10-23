import { useMemo } from 'react'
import type { EntryRef } from '@retromode/shared'
import { accentVars } from '../lib/columns'
import * as model from '../lib/model'
import { actions, useBoardData } from '../store/board'
import { useUi } from '../store/ui'
import { Dialog } from './Dialog'
import { EntryPicker } from './EntryPicker'

/** Keyboard/touch-friendly alternative to dragging an action item onto something to improve. */
export function LinkDialog() {
  const itemId = useUi((s) => s.linkSource)
  const close = () => useUi.getState().setLinkSource(null)
  const data = useBoardData()
  const candidates = useMemo(() => model.columnEntries(data, model.LINK_TARGET), [data])

  const pick = (target: EntryRef) => {
    if (itemId) actions.linkItem(itemId, target)
    close()
  }

  return (
    <Dialog open={!!itemId} onClose={close} title="Tie to…">
      <div style={accentVars(model.LINK_TARGET)}>
        <EntryPicker
          entries={candidates}
          empty="Nothing to improve yet."
          selected={itemId ? data.items[itemId]?.link : null}
          onPick={pick}
        />
      </div>
    </Dialog>
  )
}

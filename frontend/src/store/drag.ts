import { create } from 'zustand'
import type { EntryRef } from '@retromode/shared'

/** `link` ties an action item to something to improve instead of merging. */
export type DropMode = 'before' | 'after' | 'merge' | 'link' | 'end'

/** Where the dragged entry would land: `key` is `item:<id>`, `group:<id>` or `column:<key>`. */
export interface DropHint {
  key: string
  mode: DropMode
}

interface DragState {
  active: EntryRef | null
  hint: DropHint | null
}

export const useDrag = create<DragState>(() => ({ active: null, hint: null }))

/** Drop mode for one entry, or null; components subscribe to just their own hint. */
export const useDropMode = (key: string): DropMode | null =>
  useDrag((s) => (s.hint?.key === key ? s.hint.mode : null))

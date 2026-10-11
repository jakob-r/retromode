import { create } from 'zustand'
import type { EntryRef } from '@retromode/shared'

interface UiState {
  /** Entry for which the "Merge with…" picker is open */
  mergeSource: EntryRef | null
  setMergeSource: (ref: EntryRef | null) => void
  /** Action item for which the "Tie to…" picker is open */
  linkSource: string | null
  setLinkSource: (itemId: string | null) => void
  /** "To improve" entry a new action item is being written for */
  actionFor: EntryRef | null
  setActionFor: (ref: EntryRef | null) => void
}

export const useUi = create<UiState>((set) => ({
  mergeSource: null,
  setMergeSource: (mergeSource) => set({ mergeSource }),
  linkSource: null,
  setLinkSource: (linkSource) => set({ linkSource }),
  actionFor: null,
  setActionFor: (actionFor) => set({ actionFor }),
}))

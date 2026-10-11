import { create } from 'zustand'
import type { EntryRef } from '@retromode/shared'

interface UiState {
  /** Entry for which the "Merge with…" picker is open */
  mergeSource: EntryRef | null
  setMergeSource: (ref: EntryRef | null) => void
}

export const useUi = create<UiState>((set) => ({
  mergeSource: null,
  setMergeSource: (mergeSource) => set({ mergeSource }),
}))

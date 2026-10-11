import { create } from 'zustand'
import * as identity from '../lib/identity'

interface MeState {
  nickname: string | null
  /** Default for new items; remembered across sessions */
  anonymous: boolean
  nicknameDialogOpen: boolean
  setNickname: (name: string | null) => void
  setAnonymous: (anonymous: boolean) => void
  openNicknameDialog: () => void
  closeNicknameDialog: () => void
}

export const useMe = create<MeState>((set) => ({
  nickname: identity.getNickname(),
  anonymous: identity.getAnonymousPref(),
  nicknameDialogOpen: false,
  setNickname: (name) => {
    identity.setNickname(name)
    identity.markNicknameAnswered()
    const nickname = identity.getNickname()
    set({ nickname, ...(nickname === null && { anonymous: true }) })
  },
  setAnonymous: (anonymous) => {
    identity.setAnonymousPref(anonymous)
    set({ anonymous })
  },
  openNicknameDialog: () => set({ nicknameDialogOpen: true }),
  closeNicknameDialog: () => {
    identity.markNicknameAnswered()
    set({ nicknameDialogOpen: false })
  },
}))

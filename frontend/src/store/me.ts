import { create } from 'zustand'
import * as identity from '../lib/identity'

interface MeState {
  nickname: string | null
  /** Default for new items; remembered across sessions */
  anonymous: boolean
  nicknameDialogOpen: boolean
  setNickname: (name: string | null) => void
  setAnonymous: (anonymous: boolean) => void
  /** Answers the "what should we call you" prompt; an empty answer means staying anonymous */
  answerNickname: (name: string) => void
  openNicknameDialog: () => void
  closeNicknameDialog: () => void
}

export const useMe = create<MeState>((set, get) => ({
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
  answerNickname: (name) => {
    const { nickname, setNickname, setAnonymous } = get()
    if (name.trim()) {
      setNickname(name)
      setAnonymous(false)
    } else {
      if (!nickname) setAnonymous(true)
      identity.markNicknameAnswered()
    }
  },
  openNicknameDialog: () => set({ nicknameDialogOpen: true }),
  closeNicknameDialog: () => {
    identity.markNicknameAnswered()
    set({ nicknameDialogOpen: false })
  },
}))

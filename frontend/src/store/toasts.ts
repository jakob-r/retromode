import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error' | 'success'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = nextId++
    // Collapse identical messages that pile up
    set({
      toasts: [...get().toasts.filter((t) => t.message !== message), { id, message, tone }].slice(
        -3,
      ),
    })
    setTimeout(() => get().dismiss(id), 3200)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = (message: string, tone?: Toast['tone']) =>
  useToasts.getState().push(message, tone)

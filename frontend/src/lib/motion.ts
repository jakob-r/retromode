import confetti from 'canvas-confetti'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const spring = { type: 'spring', stiffness: 420, damping: 28 } as const
export const softSpring = { type: 'spring', stiffness: 260, damping: 24 } as const

const COLORS = ['#3DDC97', '#FF6B6B', '#8B5CF6', '#FFD23F']

export function celebrate(): void {
  if (prefersReducedMotion()) return
  const base = { colors: COLORS, ticks: 220, scalar: 1.05, disableForReducedMotion: true }
  void confetti({ ...base, particleCount: 90, spread: 75, origin: { x: 0.5, y: 0.35 } })
  setTimeout(() => {
    void confetti({ ...base, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } })
    void confetti({ ...base, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } })
  }, 180)
}

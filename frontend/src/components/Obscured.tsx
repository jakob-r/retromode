import { useMemo, type ReactNode } from 'react'
import { useBoard } from '../store/board'

/** Whether the timer currently hides other people's items. */
export const useItemsHidden = () =>
  useBoard((s) => s.timerEndsAt !== null && !!s.board?.timer?.hideItems)

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i))

const HIEROGLYPHS = range(0x13000, 0x1342e)
const RUNES = range(0x16a0, 0x16ea)
const BRAILLE = range(0x2801, 0x28ff)
const DINGBATS = [...'✈☎✂✉☞☜☀☁☂☃★☆♠♣♥♦♪♫☯☮✿❀❁✪✸✹⚓⚑⌘♞♜☠☢☘❄✌✍⌛⚡☕']

/** Each character gets one of these, picked at random (but stably). */
const METHODS = [
  { kind: 'glyph', set: HIEROGLYPHS, className: 'font-hieroglyph' },
  { kind: 'glyph', set: DINGBATS, className: '' },
  { kind: 'glyph', set: RUNES, className: 'font-runic' },
  { kind: 'glyph', set: BRAILLE, className: '' },
  { kind: 'blackout' },
] as const

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Renders text with every character swapped for a hieroglyph, a dingbat, a rune,
 * braille or a blacked-out bar. Spaces and line breaks stay, so word shapes remain.
 * The real text never ends up in the DOM.
 */
export function Obscured({ text, seed }: { text: string; seed: string }) {
  const parts = useMemo(() => {
    let s = hash(seed) || 1
    const rand = () => (s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0)
    const out: ReactNode[] = []
    let i = 0
    for (const ch of text) {
      i++
      if (/\s/.test(ch)) {
        out.push(ch)
        continue
      }
      const method = METHODS[rand() % METHODS.length]!
      if (method.kind === 'blackout') {
        out.push(
          <span key={i} className="rounded-[2px] bg-ink text-transparent select-none">
            x
          </span>,
        )
      } else {
        const glyph = method.set[rand() % method.set.length]!
        out.push(
          method.className ? (
            <span key={i} className={method.className}>
              {glyph}
            </span>
          ) : (
            glyph
          ),
        )
      }
    }
    return out
  }, [text, seed])

  return (
    <span aria-label="Hidden until the timer runs out" title="Hidden until the timer runs out 🙈">
      <span aria-hidden>{parts}</span>
    </span>
  )
}

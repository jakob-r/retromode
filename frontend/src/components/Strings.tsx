import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { EntryRef } from '@retromode/shared'
import * as model from '../lib/model'
import { prefersReducedMotion } from '../lib/motion'
import { useBoardData } from '../store/board'
import { useDrag } from '../store/drag'

/**
 * Cards mark themselves with this so strings know where to attach. Copies in
 * the DragOverlay use a separate attribute, so a string follows a dragged card.
 */
export const stringAnchor = (ref: EntryRef, overlay: boolean) => ({
  [overlay ? 'data-string-overlay' : 'data-string-anchor']: `${ref.type}:${ref.id}`,
})

function findCard(key: string): Element | null {
  return (
    document.querySelector(`[data-string-overlay="${key}"]`) ??
    document.querySelector(`[data-string-anchor="${key}"]`)
  )
}

type Side = 'left' | 'right'

function attach(r: DOMRect, side: Side, origin: DOMRect) {
  return {
    x: (side === 'left' ? r.left : r.right) - origin.left,
    y: r.top + Math.min(r.height / 2, 26) - origin.top,
  }
}

/** A sagging cubic curve from the improve card to the action card. */
function hang(target: DOMRect, source: DOMRect, origin: DOMRect, slack: number) {
  let sides: [Side, Side]
  if (target.right <= source.left) sides = ['right', 'left']
  else if (source.right <= target.left) sides = ['left', 'right']
  else sides = ['left', 'left'] // stacked: loop out to the left
  const a = attach(target, sides[0], origin)
  const b = attach(source, sides[1], origin)
  const dir = (side: Side) => (side === 'right' ? 1 : -1)
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const reach =
    sides[0] === sides[1]
      ? 40 + Math.abs(b.y - a.y) * 0.12
      : Math.max(36, Math.abs(b.x - a.x) * 0.35)
  const sag = Math.min(160, 44 + dist * 0.22) + slack
  const c1 = { x: a.x + dir(sides[0]) * reach, y: a.y + sag }
  const c2 = { x: b.x + dir(sides[1]) * reach, y: b.y + sag }
  return { d: `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`, a, b }
}

const DRAW_MS = 450
const WOBBLE_MS = 1600

/**
 * Loose strings from action items to the "To improve" entries they address.
 * Positions are read from the DOM every frame, so strings follow layout
 * animations and dragged cards, and sway a little.
 */
export function Strings() {
  const data = useBoardData()
  const active = useDrag((s) => s.active)
  const hint = useDrag((s) => s.hint)
  const svgRef = useRef<SVGSVGElement>(null)
  /** key → when the string first appeared (-Infinity: was there on load) */
  const born = useRef(new Map<string, number>())
  const mounted = useRef(false)

  const strings = useMemo(() => model.links(data), [data])

  // While dragging onto a tie target, preview the string that dropping would make
  const preview = useMemo(() => {
    if (!active || hint?.mode !== 'link') return null
    const [type, id] = hint.key.split(':') as [EntryRef['type'], string]
    return model.linkBetween(data, active, { type, id })
  }, [active, hint, data])

  useLayoutEffect(() => {
    const now = performance.now()
    const keys = new Set(strings.map((s) => s.key))
    for (const key of born.current.keys()) if (!keys.has(key)) born.current.delete(key)
    for (const key of keys) {
      if (!born.current.has(key)) born.current.set(key, mounted.current ? now : -Infinity)
    }
    mounted.current = true
  }, [strings])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const still = prefersReducedMotion()
    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const origin = svg.getBoundingClientRect()
      svg.querySelectorAll<SVGGElement>('g[data-string]').forEach((g, index) => {
        const { string: key = '', source = '', target = '' } = g.dataset
        const s = findCard(source)?.getBoundingClientRect()
        const t = findCard(target)?.getBoundingClientRect()
        // Hidden cards (e.g. other columns on mobile) have no size
        if (!s?.width || !t?.width) {
          g.style.display = 'none'
          return
        }
        g.style.display = ''
        const age = now - (born.current.get(key) ?? -Infinity)
        let slack = 0
        if (!still) {
          slack = Math.sin(now / 900 + index * 1.7) * 3
          // A freshly tied string twangs
          if (age < WOBBLE_MS) slack += 18 * Math.exp(-age / 350) * Math.sin(age / 65)
        }
        const { d, a, b } = hang(t, s, origin, slack)
        const [base, yarn, knotA, knotB] = g.children as unknown as [
          SVGPathElement,
          SVGPathElement,
          SVGCircleElement,
          SVGCircleElement,
        ]
        base.setAttribute('d', d)
        yarn.setAttribute('d', d)
        knotA.setAttribute('cx', String(a.x))
        knotA.setAttribute('cy', String(a.y))
        knotB.setAttribute('cx', String(b.x))
        knotB.setAttribute('cy', String(b.y))
        // Draw new strings in from the action item
        const drawn = still ? 1 : Math.min(1, Math.max(0, age / DRAW_MS))
        base.style.strokeDasharray = drawn < 1 ? '1' : ''
        base.style.strokeDashoffset = drawn < 1 ? String(drawn - 1) : ''
        yarn.style.opacity = String(drawn)
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const all = [
    ...strings.map((s) => ({ ...s, preview: false })),
    ...(preview
      ? [{ ...preview, key: `preview:${preview.itemId}>${preview.target.id}`, preview: true }]
      : []),
  ]

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
    >
      <defs>
        <linearGradient id="string-yarn" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--color-coral)" />
          <stop offset="1" stopColor="var(--color-violet)" />
        </linearGradient>
      </defs>
      {all.map((s) => (
        <g
          key={s.key}
          data-string={s.key}
          data-source={`item:${s.itemId}`}
          data-target={`${s.target.type}:${s.target.id}`}
          style={{ display: 'none' }}
          opacity={s.preview ? 0.75 : 1}
        >
          <path
            pathLength={1}
            fill="none"
            stroke="url(#string-yarn)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={s.preview ? '0.025 0.02' : undefined}
          />
          {/* Twisted-yarn highlight */}
          <path
            fill="none"
            stroke="white"
            strokeOpacity={s.preview ? 0 : 0.55}
            strokeWidth={2}
            strokeDasharray="2 5"
            strokeLinecap="round"
          />
          <circle r={4.5} fill="var(--color-coral)" stroke="white" strokeWidth={2} />
          <circle r={4.5} fill="var(--color-violet)" stroke="white" strokeWidth={2} />
        </g>
      ))}
    </svg>
  )
}

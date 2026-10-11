import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

export interface Positioned {
  id: string
  position: string
}

export function comparePositioned(a: Positioned, b: Positioned): number {
  if (a.position < b.position) return -1
  if (a.position > b.position) return 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function sortPositioned<T extends Positioned>(entries: T[]): T[] {
  return [...entries].sort(comparePositioned)
}

/**
 * Position key for placing an entry right after `afterId` among `siblings`
 * (null = first). Unknown `afterId` appends at the end. The moved entry itself
 * must not be part of `siblings`.
 */
export function positionAfter(siblings: Positioned[], afterId: string | null): string {
  const sorted = sortPositioned(siblings)
  let index: number
  if (afterId === null) index = -1
  else {
    index = sorted.findIndex((s) => s.id === afterId)
    if (index === -1) index = sorted.length - 1
  }
  const prev = sorted[index]?.position ?? null
  let next = sorted[index + 1]?.position ?? null
  // Equal keys can't be split; fall back to placing after prev.
  if (prev !== null && next !== null && prev >= next) next = null
  return generateKeyBetween(prev, next)
}

export function positionAtEnd(siblings: Positioned[]): string {
  const sorted = sortPositioned(siblings)
  return generateKeyBetween(sorted.at(-1)?.position ?? null, null)
}

/** `n` keys between two positions (either may be null). */
export function positionsBetween(prev: string | null, next: string | null, n: number): string[] {
  if (prev !== null && next !== null && prev >= next) next = null
  return generateNKeysBetween(prev, next, n)
}

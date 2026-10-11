import { describe, expect, it } from 'vitest'
import { positionAfter, positionAtEnd, positionsBetween, sortPositioned } from './positions'

const e = (id: string, position: string) => ({ id, position })

describe('positions', () => {
  it('places first, middle and last', () => {
    const siblings = [e('a', 'a0'), e('b', 'a1')]
    expect(positionAfter(siblings, null) < 'a0').toBe(true)
    const mid = positionAfter(siblings, 'a')
    expect(mid > 'a0' && mid < 'a1').toBe(true)
    expect(positionAfter(siblings, 'b') > 'a1').toBe(true)
    expect(positionAtEnd(siblings) > 'a1').toBe(true)
  })

  it('appends when afterId is unknown and works with no siblings', () => {
    expect(positionAfter([e('a', 'a0')], 'zzz') > 'a0').toBe(true)
    expect(typeof positionAfter([], null)).toBe('string')
  })

  it('handles duplicate keys without throwing', () => {
    expect(() => positionAfter([e('a', 'a0'), e('b', 'a0')], 'a')).not.toThrow()
  })

  it('sorts by position then id and creates n keys', () => {
    expect(sortPositioned([e('b', 'a0'), e('a', 'a0')]).map((x) => x.id)).toEqual(['a', 'b'])
    const keys = positionsBetween('a0', 'a1', 3)
    expect(keys).toHaveLength(3)
    expect([...keys].sort()).toEqual(keys)
  })
})

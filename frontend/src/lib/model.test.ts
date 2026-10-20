import { describe, expect, it } from 'vitest'
import { positionsBetween, type PublicItem } from '@retromode/shared'
import * as model from './model'

let n = 0
let lastPosition: string | null = null
function item(fields: Partial<PublicItem> = {}): PublicItem {
  n += 1
  lastPosition = positionsBetween(lastPosition, null, 1)[0]!
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    column: 'well',
    groupId: null,
    position: lastPosition,
    text: `item ${n}`,
    nickname: null,
    mine: false,
    votes: 0,
    myVotes: 0,
    link: null,
    createdAt: '',
    updatedAt: '',
    ...fields,
  }
}

describe('board model', () => {
  it('merges, sums votes, and dissolves single-item groups', () => {
    const a = item({ votes: 2 })
    const b = item({ votes: 3 })
    const c = item()
    let data = model.fromLists([], [a, b, c])
    data = model.merge(data, {
      source: { type: 'item', id: b.id },
      target: { type: 'item', id: a.id },
      newGroupId: 'g1',
    })
    const entries = model.columnEntries(data, 'well')
    expect(entries.map((e) => e.type)).toEqual(['group', 'item'])
    const group = entries[0]!
    expect(group.type === 'group' && group.votes).toBe(5)
    expect(group.type === 'group' && group.items.map((i) => i.id)).toEqual([a.id, b.id])

    data = model.moveItem(data, { itemId: b.id, column: 'improve', groupId: null, afterId: null })
    expect(Object.keys(data.groups)).toHaveLength(0)
    expect(data.items[a.id]!.groupId).toBeNull()
    expect(model.columnEntries(data, 'well').map((e) => e.id)).toEqual([a.id, c.id])
  })

  it('counts used votes per column and adds and removes votes', () => {
    const a = item({ myVotes: 2, votes: 3 })
    const b = item({ column: 'improve' })
    let data = model.fromLists([], [a, b])
    expect(model.votesUsed(data, 'well')).toBe(2)
    expect(model.votesUsed(data, 'improve')).toBe(0)
    data = model.vote(data, b.id, 1)
    data = model.vote(data, b.id, 1)
    expect(data.items[b.id]).toMatchObject({ votes: 2, myVotes: 2 })
    expect(model.votesUsed(data, 'improve')).toBe(2)
    data = model.vote(data, a.id, -1)
    expect(data.items[a.id]).toMatchObject({ votes: 2, myVotes: 1 })
    // Can't take back votes that aren't mine
    data = model.vote(model.vote(data, a.id, -1), a.id, -1)
    expect(data.items[a.id]).toMatchObject({ votes: 1, myVotes: 0 })
  })

  it('ungroups in place and applies server patches', () => {
    const [a, b, c] = [item(), item(), item()]
    let data = model.fromLists([], [a, b, c])
    data = model.merge(data, {
      source: { type: 'item', id: c.id },
      target: { type: 'item', id: a.id },
      newGroupId: 'g',
    })
    data = model.ungroup(data, 'g')
    expect(model.columnEntries(data, 'well').map((e) => e.id)).toEqual([a.id, c.id, b.id])
    data = model.applyPatch(data, { deletedItemIds: [a.id], items: [{ ...b, text: 'new' }] })
    expect(data.items[a.id]).toBeUndefined()
    expect(data.items[b.id]!.text).toBe('new')
  })

  it('finds the predecessor of an entry', () => {
    const [a, b] = [item(), item()]
    const data = model.fromLists([], [a, b])
    expect(model.predecessorId(data, { type: 'item', id: a.id })).toBeNull()
    expect(model.predecessorId(data, { type: 'item', id: b.id })).toBe(a.id)
  })

  it('detects links in either drag direction and re-ties strings when groups go away', () => {
    const x = item({ column: 'improve' })
    const y = item({ column: 'improve' })
    const action = item({ column: 'actions' })
    const well = item({ column: 'well' })
    let data = model.fromLists([], [x, y, action, well])
    const ref = (id: string) => ({ type: 'item' as const, id })

    expect(model.linkBetween(data, ref(action.id), ref(x.id))).toEqual({
      itemId: action.id,
      target: ref(x.id),
    })
    expect(model.linkBetween(data, ref(x.id), ref(action.id))?.itemId).toBe(action.id)
    expect(model.linkBetween(data, ref(action.id), ref(well.id))).toBeNull()
    expect(model.linkBetween(data, ref(x.id), ref(y.id))).toBeNull()

    data = model.merge(data, { source: ref(x.id), target: ref(y.id), newGroupId: 'g1' })
    data = model.link(data, action.id, { type: 'group', id: 'g1' })
    expect(model.links(data).map((l) => l.key)).toEqual([`${action.id}>group:g1`])

    data = model.moveItem(data, { itemId: x.id, column: 'improve', groupId: null, afterId: null })
    expect(data.items[action.id]!.link).toEqual(ref(y.id))
    data = model.deleteItem(data, y.id)
    expect(data.items[action.id]!.link).toBeNull()
    expect(model.links(data)).toEqual([])
  })

  it('formats action items for Slack', () => {
    const improve = item({ column: 'improve', text: 'Deploys keep failing' })
    const a = item({
      column: 'actions',
      text: 'Fix the pipeline',
      nickname: 'Sam',
      link: { type: 'item', id: improve.id },
    })
    const b = item({ column: 'actions', text: 'Pair more' })
    const c = item({ column: 'actions', text: 'Write docs\nfor onboarding' })
    let data = model.fromLists([], [improve, a, b, c])
    expect(model.actionItemsForSlack(model.fromLists([], [improve]), 'Retro')).toBeNull()
    data = model.merge(data, {
      source: { type: 'item', id: c.id },
      target: { type: 'item', id: b.id },
      newGroupId: 'g1',
    })
    data = model.patchGroup(data, 'g1', { title: 'Team' })
    expect(model.actionItemsForSlack(data, 'Sprint 42')).toBe(
      [
        '*🚀 Action items · Sprint 42*',
        '• Fix the pipeline _(Sam)_',
        '      ↳ _Deploys keep failing_',
        '• *Team*',
        '      ◦ Pair more',
        '      ◦ Write docs',
        '         for onboarding',
      ].join('\n'),
    )
  })
  it("exports the board as JSON, hiding other people's texts on request", () => {
    const improve = item({ column: 'improve', text: 'Slow CI', votes: 2 })
    const mine = item({ column: 'well', text: 'Pairing', mine: true, nickname: 'Kim' })
    const action = item({
      column: 'actions',
      text: 'Cache deps',
      link: { type: 'item', id: improve.id },
    })
    const data = model.fromLists([], [improve, mine, action])
    const board = {
      slug: 'abcdef',
      title: 'Retro',
      voteLimit: 5,
      locked: false,
      timer: null,
      isOwner: false,
      createdAt: '',
    }
    const json = model.boardAsJson(data, board)
    expect(json.columns.improve.entries).toEqual([
      { type: 'item', id: improve.id, text: 'Slow CI', author: null, votes: 2, mine: false },
    ])
    expect(json.columns.actions.entries[0]).toMatchObject({
      text: 'Cache deps',
      addresses: { type: 'item', id: improve.id, text: 'Slow CI' },
    })
    const hidden = model.boardAsJson(data, board, true)
    expect(hidden.itemsHidden).toBe(true)
    expect(hidden.columns.well.entries[0]).toMatchObject({ text: 'Pairing', author: 'Kim' })
    expect(hidden.columns.actions.entries[0]).toMatchObject({
      text: null,
      addresses: { text: null },
    })
  })
})

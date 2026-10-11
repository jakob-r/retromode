import { randomUUID } from 'node:crypto'
import { eq, inArray, sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { sortPositioned } from '@retromode/shared'
import * as schema from '../db/schema'
import * as boards from './boards'
import { DomainError } from './errors'
import { snapshotFor } from './public'
import { db, pool, setupBoard } from '../test/helpers'

afterAll(() => pool.end())

const rejects = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(DomainError)
  await expect(promise).rejects.toMatchObject({ code })
}

describe('boards', () => {
  it('creates a board with an unguessable slug and an owner key', async () => {
    const { slug, ownerKey, board, owner } = await setupBoard()
    expect(slug).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(board.voteLimit).toBe(3)
    expect(boards.isBoardOwner(board, owner)).toBe(true)
    expect(boards.isBoardOwner(board, randomUUID())).toBe(false)
    expect(boards.isBoardOwner(board, randomUUID(), ownerKey)).toBe(true)
    expect(boards.isBoardOwner(board, randomUUID(), 'wrong')).toBe(false)
  })
})

describe('items', () => {
  it('stores nickname or anonymity per item and puts new items on top', async () => {
    const { actor, addItem, state } = await setupBoard()
    const me = actor()
    const first = await addItem(me, 'well', 'one', { nickname: 'Kim' })
    const second = await addItem(me, 'well', 'two', { anonymous: true, nickname: 'Kim' })
    const s = await state()
    const ordered = sortPositioned(s.items).map((i) => i.id)
    expect(ordered).toEqual([second, first])
    expect(s.items.find((i) => i.id === first)!.authorNickname).toBe('Kim')
    expect(s.items.find((i) => i.id === second)!.authorNickname).toBeNull()
  })

  it('lets only the author edit, and the author or owner delete', async () => {
    const { actor, ownerActor, addItem, state } = await setupBoard()
    const author = actor()
    const other = actor()
    const id = await addItem(author, 'well', 'mine', { nickname: 'Kim' })

    await rejects(boards.updateItem(db, other, { itemId: id, text: 'hacked' }), 'FORBIDDEN')
    await rejects(boards.updateItem(db, ownerActor, { itemId: id, text: 'nope' }), 'FORBIDDEN')
    await boards.updateItem(db, author, { itemId: id, text: 'edited', anonymous: true })
    let item = (await state()).items[0]!
    expect(item.text).toBe('edited')
    expect(item.authorNickname).toBeNull()
    await boards.updateItem(db, author, { itemId: id, anonymous: false, nickname: 'Kimmy' })
    item = (await state()).items[0]!
    expect(item.authorNickname).toBe('Kimmy')

    await rejects(boards.deleteItem(db, other, { itemId: id }), 'FORBIDDEN')
    await boards.deleteItem(db, ownerActor, { itemId: id })
    expect((await state()).items).toHaveLength(0)
  })

  it('never exposes client ids in public payloads', async () => {
    const { actor, addItem, state } = await setupBoard()
    const author = actor()
    const id = await addItem(author, 'well', 'secret', { anonymous: true })
    await boards.addVote(db, author, { itemId: id })
    const forOther = snapshotFor(await state(), { clientId: randomUUID(), isOwner: false }, 2)
    const json = JSON.stringify(forOther)
    expect(json).not.toContain(author.clientId)
    expect(forOther.items[0]).toMatchObject({
      nickname: null,
      mine: false,
      votes: 1,
      myVotes: 0,
    })
    const forAuthor = snapshotFor(await state(), author, 2)
    expect(forAuthor.items[0]).toMatchObject({ mine: true, myVotes: 1 })
  })
})

describe('votes', () => {
  it('limits votes per person per column and allows taking votes back', async () => {
    const { actor, addItem, ownerActor, state } = await setupBoard()
    const me = actor()
    const well = await Promise.all([1, 2, 3, 4].map(() => addItem(me, 'well')))
    const improve = await addItem(me, 'improve')

    for (const id of well.slice(0, 3)) await boards.addVote(db, me, { itemId: id })
    await rejects(boards.addVote(db, me, { itemId: well[3]! }), 'VOTE_LIMIT')
    // Another column has its own budget
    await boards.addVote(db, me, { itemId: improve })
    // Taking one back frees a vote
    await boards.removeVote(db, me, { itemId: well[0]! })
    await boards.addVote(db, me, { itemId: well[3]! })

    // Lowering the limit keeps existing votes but blocks new ones
    await boards.updateSettings(db, ownerActor, { voteLimit: 1 })
    await rejects(boards.addVote(db, me, { itemId: well[0]! }), 'VOTE_LIMIT')
    const voters = (await state()).voters
    expect(well.filter((id) => voters.get(id)?.has(me.clientId))).toHaveLength(3)
  })

  it('lets one person put several votes on an item and take only their own back', async () => {
    const { actor, addItem, state } = await setupBoard()
    const me = actor()
    const other = actor()
    const [id, rest] = [await addItem(me, 'well'), await addItem(me, 'well')]

    for (let i = 0; i < 3; i++) await boards.addVote(db, me, { itemId: id })
    await rejects(boards.addVote(db, me, { itemId: rest }), 'VOTE_LIMIT')
    await boards.addVote(db, other, { itemId: id })
    // Removing without own votes changes nothing
    await boards.removeVote(db, actor(), { itemId: id })
    expect(snapshotFor(await state(), me, 1).items.find((i) => i.id === id)).toMatchObject({
      votes: 4,
      myVotes: 3,
    })

    await boards.removeVote(db, me, { itemId: id })
    await boards.addVote(db, me, { itemId: rest })
    for (let i = 0; i < 2; i++) await boards.removeVote(db, me, { itemId: id })
    const voters = (await state()).voters
    expect(voters.get(id)).toEqual(new Map([[other.clientId, 1]]))
    expect(voters.get(rest)?.get(me.clientId)).toBe(1)
  })

  it('serializes concurrent votes so the budget cannot be exceeded', async () => {
    const { actor, addItem, state } = await setupBoard()
    const me = actor()
    const ids = await Promise.all([1, 2, 3, 4, 5, 6].map(() => addItem(me, 'actions')))
    const results = await Promise.allSettled(
      ids.map((id) => boards.addVote(db, me, { itemId: id })),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
    const voters = (await state()).voters
    expect([...voters.values()].filter((v) => v.has(me.clientId))).toHaveLength(3)
  })
})

describe('grouping', () => {
  it('merges two items into a group at the target position and sums votes', async () => {
    const { actor, addItem, state } = await setupBoard()
    const a = actor()
    const b = actor()
    const x = await addItem(a, 'well', 'x')
    const y = await addItem(a, 'well', 'y')
    const z = await addItem(a, 'well', 'z') // order: z, y, x
    await boards.addVote(db, a, { itemId: x })
    await boards.addVote(db, b, { itemId: z })

    const groupId = randomUUID()
    await boards.mergeEntries(db, b, {
      source: { type: 'item', id: z },
      target: { type: 'item', id: x },
      newGroupId: groupId,
    })
    const s = await state()
    expect(s.groups).toHaveLength(1)
    const members = sortPositioned(s.items.filter((i) => i.groupId === groupId)).map((i) => i.id)
    expect(members).toEqual([x, z])
    const top = sortPositioned([...s.groups, ...s.items.filter((i) => !i.groupId)]).map((e) => e.id)
    expect(top).toEqual([y, groupId])
    const total = members.reduce((sum, id) => sum + (s.voters.get(id)?.size ?? 0), 0)
    expect(total).toBe(2)
  })

  it('adds to existing groups, merges groups, and dissolves groups with one item', async () => {
    const { actor, addItem, state } = await setupBoard()
    const a = actor()
    const [i1, i2, i3, i4] = await Promise.all([1, 2, 3, 4].map((n) => addItem(a, 'well', `${n}`)))
    const g1 = randomUUID()
    const g2 = randomUUID()
    await boards.mergeEntries(db, a, {
      source: { type: 'item', id: i1! },
      target: { type: 'item', id: i2! },
      newGroupId: g1,
    })
    // Dropping onto an item inside a group adds to that group
    await boards.mergeEntries(db, a, {
      source: { type: 'item', id: i3! },
      target: { type: 'item', id: i1! },
      newGroupId: randomUUID(),
    })
    expect((await state()).items.filter((i) => i.groupId === g1)).toHaveLength(3)

    // Group onto standalone item: new group with all items, old group removed
    await boards.mergeEntries(db, a, {
      source: { type: 'group', id: g1 },
      target: { type: 'item', id: i4! },
      newGroupId: g2,
    })
    let s = await state()
    expect(s.groups.map((g) => g.id)).toEqual([g2])
    expect(s.items.every((i) => i.groupId === g2)).toBe(true)

    // Moving items out one by one dissolves the group when one item is left
    for (const id of [i1!, i2!]) {
      await boards.moveItem(db, a, { itemId: id, column: 'improve', groupId: null, afterId: null })
    }
    await boards.moveItem(db, a, { itemId: i3!, column: 'well', groupId: null, afterId: null })
    s = await state()
    expect(s.groups).toHaveLength(0)
    expect(s.items.every((i) => i.groupId === null)).toBe(true)
    expect(s.items.find((i) => i.id === i4)!.column).toBe('well')
  })

  it('ungroups in place and moves groups across columns with their items', async () => {
    const { actor, addItem, state } = await setupBoard()
    const a = actor()
    const top = await addItem(a, 'well', 'bottom')
    const x = await addItem(a, 'well', 'x')
    const y = await addItem(a, 'well', 'y')
    const before = await addItem(a, 'well', 'top')
    const g = randomUUID()
    await boards.mergeEntries(db, a, {
      source: { type: 'item', id: y },
      target: { type: 'item', id: x },
      newGroupId: g,
    })
    await boards.updateGroup(db, a, { groupId: g, title: 'Theme' })
    await boards.moveGroup(db, a, { groupId: g, column: 'improve', afterId: null })
    let s = await state()
    expect(s.groups[0]).toMatchObject({ column: 'improve', title: 'Theme' })
    expect(s.items.filter((i) => i.groupId === g).every((i) => i.column === 'improve')).toBe(true)

    await boards.moveGroup(db, a, { groupId: g, column: 'well', afterId: before })
    await boards.ungroup(db, a, { groupId: g })
    s = await state()
    expect(s.groups).toHaveLength(0)
    expect(sortPositioned(s.items).map((i) => i.id)).toEqual([before, x, y, top])
  })
})

describe('links', () => {
  const linkOf = async (state: () => Promise<boards.BoardState>, id: string) => {
    const item = (await state()).items.find((i) => i.id === id)!
    return { item: item.linkedItemId, group: item.linkedGroupId }
  }

  it('ties action items to things to improve, and only those', async () => {
    const { actor, addItem, state } = await setupBoard()
    const a = actor()
    const improve = await addItem(a, 'improve')
    const well = await addItem(a, 'well')
    const action = await addItem(a, 'actions')

    await rejects(
      boards.linkItem(db, a, { itemId: action, target: { type: 'item', id: well } }),
      'INVALID',
    )
    await rejects(
      boards.linkItem(db, a, { itemId: well, target: { type: 'item', id: improve } }),
      'INVALID',
    )
    const changes = await boards.linkItem(db, a, {
      itemId: action,
      target: { type: 'item', id: improve },
    })
    expect([...changes.itemIds]).toEqual([action])
    expect(await linkOf(state, action)).toEqual({ item: improve, group: null })

    await boards.linkItem(db, a, { itemId: action, target: null })
    expect(await linkOf(state, action)).toEqual({ item: null, group: null })

    const created = randomUUID()
    await boards.createItem(db, a, {
      id: created,
      column: 'actions',
      text: 'do it',
      anonymous: true,
      link: { type: 'item', id: improve },
    })
    expect(await linkOf(state, created)).toEqual({ item: improve, group: null })
    await rejects(
      boards.createItem(db, a, {
        id: randomUUID(),
        column: 'well',
        text: 'nope',
        anonymous: true,
        link: { type: 'item', id: improve },
      }),
      'INVALID',
    )
  })

  it('moves strings to the leftover item when a group goes away, and cuts them on delete', async () => {
    const { actor, addItem, state } = await setupBoard()
    const a = actor()
    const x = await addItem(a, 'improve')
    const y = await addItem(a, 'improve')
    const action = await addItem(a, 'actions')
    const groupId = randomUUID()
    await boards.mergeEntries(db, a, {
      source: { type: 'item', id: x },
      target: { type: 'item', id: y },
      newGroupId: groupId,
    })
    await boards.linkItem(db, a, { itemId: action, target: { type: 'group', id: groupId } })
    expect(await linkOf(state, action)).toEqual({ item: null, group: groupId })

    // Taking x out dissolves the group; y is left over and takes the string
    const changes = await boards.moveItem(db, a, {
      itemId: x,
      column: 'improve',
      groupId: null,
      afterId: null,
    })
    expect(changes.itemIds.has(action)).toBe(true)
    expect(await linkOf(state, action)).toEqual({ item: y, group: null })

    const deleted = await boards.deleteItem(db, a, { itemId: y })
    expect(deleted.itemIds.has(action)).toBe(true)
    expect(await linkOf(state, action)).toEqual({ item: null, group: null })
  })

  it('hands the string to the first item when a group is ungrouped', async () => {
    const { actor, addItem, state } = await setupBoard()
    const a = actor()
    const x = await addItem(a, 'improve')
    const y = await addItem(a, 'improve')
    const action = await addItem(a, 'actions')
    const groupId = randomUUID()
    await boards.mergeEntries(db, a, {
      source: { type: 'item', id: x },
      target: { type: 'item', id: y },
      newGroupId: groupId,
    })
    await boards.linkItem(db, a, { itemId: action, target: { type: 'group', id: groupId } })
    await boards.ungroup(db, a, { groupId })
    // y was the merge target, so it is the group's first item
    expect(await linkOf(state, action)).toEqual({ item: y, group: null })
  })
})

describe('owner settings & lock', () => {
  it('only lets the owner change settings', async () => {
    const { actor, ownerActor, state } = await setupBoard()
    await rejects(boards.updateSettings(db, actor(), { voteLimit: 5 }), 'FORBIDDEN')
    await boards.updateSettings(db, ownerActor, { voteLimit: 5, title: 'Sprint 42' })
    expect((await state()).board).toMatchObject({ voteLimit: 5, title: 'Sprint 42' })
  })

  it('makes a locked board read-only for everyone until the owner unlocks it', async () => {
    const { actor, ownerActor, addItem } = await setupBoard()
    const a = actor()
    const id = await addItem(a)
    await boards.updateSettings(db, ownerActor, { locked: true })

    await rejects(addItem(a), 'LOCKED')
    await rejects(addItem(ownerActor), 'LOCKED')
    await rejects(boards.addVote(db, a, { itemId: id }), 'LOCKED')
    await rejects(boards.updateItem(db, a, { itemId: id, text: 'x' }), 'LOCKED')
    await rejects(boards.deleteItem(db, ownerActor, { itemId: id }), 'LOCKED')
    await rejects(boards.updateSettings(db, ownerActor, { voteLimit: 9 }), 'LOCKED')
    await rejects(boards.updateSettings(db, a, { locked: false }), 'FORBIDDEN')

    await boards.updateSettings(db, ownerActor, { locked: false })
    await boards.addVote(db, a, { itemId: id })
  })
})

describe('nuke', () => {
  it('lets only the owner delete the board with every item, group and vote, even when locked', async () => {
    const { board, actor, ownerActor, addItem } = await setupBoard()
    const a = actor()
    const first = await addItem(a)
    const second = await addItem(a)
    await boards.addVote(db, a, { itemId: first })
    await boards.mergeEntries(db, a, {
      source: { type: 'item', id: second },
      target: { type: 'item', id: first },
      newGroupId: randomUUID(),
    })
    await boards.updateSettings(db, ownerActor, { locked: true })

    await rejects(boards.nukeBoard(db, a), 'FORBIDDEN')
    await boards.nukeBoard(db, ownerActor)

    expect(await db.select().from(schema.boards).where(eq(schema.boards.id, board.id))).toEqual([])
    expect(
      await db.select().from(schema.groups).where(eq(schema.groups.boardId, board.id)),
    ).toEqual([])
    expect(await db.select().from(schema.items).where(eq(schema.items.boardId, board.id))).toEqual(
      [],
    )
    expect(
      await db
        .select()
        .from(schema.votes)
        .where(inArray(schema.votes.itemId, [first, second])),
    ).toEqual([])
    await rejects(boards.nukeBoard(db, ownerActor), 'NOT_FOUND')
  })
})

describe('timer', () => {
  it('lets anyone start and stop the shared timer, even on a locked board', async () => {
    const { actor, ownerActor, state } = await setupBoard()
    const a = actor()
    const viewer = { clientId: a.clientId, isOwner: false }
    await boards.updateSettings(db, ownerActor, { locked: true })

    await boards.setTimer(db, a, { seconds: 300, hideItems: true })
    const timer = snapshotFor(await state(), viewer, 1).board.timer
    expect(timer?.seconds).toBe(300)
    expect(timer?.hideItems).toBe(true)
    expect(timer?.remainingMs).toBeGreaterThan(299_000)
    expect(timer?.remainingMs).toBeLessThanOrEqual(300_000)

    await boards.setTimer(db, a, { seconds: null })
    expect(snapshotFor(await state(), viewer, 1).board.timer).toBeNull()
  })

  it('reports a timer that ran out as stopped', async () => {
    const { actor, board, state } = await setupBoard()
    const a = actor()
    await boards.setTimer(db, a, { seconds: 60 })
    await db.execute(
      sql`update boards set timer_ends_at = now() - interval '1 second' where id = ${board.id}`,
    )
    expect(
      snapshotFor(await state(), { clientId: a.clientId, isOwner: false }, 1).board.timer,
    ).toBeNull()
  })
})

describe('maintenance', () => {
  it('deletes boards without recent activity', async () => {
    const { board } = await setupBoard()
    expect(await boards.deleteInactiveBoards(db, 90)).toBe(0)
    await db.execute(
      sql`update boards set last_activity_at = now() - interval '91 days' where id = ${board.id}`,
    )
    expect(await boards.deleteInactiveBoards(db, 90)).toBeGreaterThanOrEqual(1)
    expect(await boards.findBoardBySlug(db, board.slug)).toBeUndefined()
  })
})

import { randomUUID } from 'node:crypto'
import type { ColumnKey } from '@retromode/shared'
import { loadConfig } from '../config'
import * as boards from '../domain/boards'
import { createDb } from './client'

/** Creates a demo board with items, a group and some votes, and prints its URLs. */
const config = loadConfig()
const { db, pool } = createDb(config.DATABASE_URL)

const owner = randomUUID()
const { slug, ownerKey } = await boards.createBoard(db, { title: 'Demo Retro ✨', clientId: owner })
const board = (await boards.findBoardBySlug(db, slug))!
const people = ['Kim', 'Alex', 'Sam', 'Robin'].map((nickname) => ({
  nickname,
  actor: { boardId: board.id, clientId: randomUUID(), isOwner: false },
}))

const entries: [ColumnKey, string, number, boolean][] = [
  ['well', 'Pairing on the release pipeline was super productive', 0, false],
  ['well', 'Release went out without a hitch 🚀', 1, false],
  ['well', 'Smooth deployment this time', 2, true],
  ['well', 'Great support from the design team', 3, false],
  ['improve', 'Too many meetings on Wednesdays', 0, true],
  ['improve', 'Flaky end-to-end tests', 1, false],
  ['improve', 'Code reviews take too long', 2, false],
  ['actions', 'Try a meeting-free Wednesday afternoon', 3, false],
  ['actions', 'Quarantine flaky tests and track them on the board', 1, false],
]

const ids: string[] = []
for (const [column, text, who, anonymous] of entries) {
  const id = randomUUID()
  const person = people[who]!
  await boards.createItem(db, person.actor, {
    id,
    column,
    text,
    anonymous,
    nickname: person.nickname,
  })
  ids.push(id)
}

await boards.mergeEntries(db, people[0]!.actor, {
  source: { type: 'item', id: ids[2]! },
  target: { type: 'item', id: ids[1]! },
  newGroupId: randomUUID(),
})

const votesFor: [number, number[]][] = [
  [1, [0, 1, 2]],
  [2, [3]],
  [5, [0, 1, 2, 3]],
  [4, [2, 3]],
  [8, [0, 1]],
]
for (const [item, voters] of votesFor) {
  for (const v of voters) await boards.toggleVote(db, people[v]!.actor, { itemId: ids[item]! })
}

const base = `http://localhost:${process.env.FRONTEND_PORT ?? 5173}`
console.log(`✔ Demo board created
  Board:       ${base}/b/${slug}
  Admin link:  ${base}/b/${slug}?owner=${ownerKey}`)
await pool.end()

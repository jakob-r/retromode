/**
 * The board as WebMCP tools, so an AI agent in the browser can read and work
 * the board as the person who opened it: same identity, same nickname, same
 * permissions. Every write goes through the regular store actions and waits for
 * the server's answer, so the agent learns about rejections.
 */
import { COLUMNS, LIMITS, type Ack, type ColumnKey, type EntryRef } from '@retromode/shared'
import * as model from '../lib/model'
import { registerTools, type WebMcpTool } from '../lib/webmcp'
import { actions, nextPatch, useBoard } from './board'
import { useMe } from './me'

const get = useBoard.getState
const data = (): model.BoardData => ({ items: get().items, groups: get().groups })

function readyBoard() {
  const { board, status } = get()
  if (!board || status !== 'ready')
    throw new Error('The board is not loaded (or offline) right now')
  return board
}

function writableBoard() {
  const board = readyBoard()
  if (board.locked) throw new Error('This board is locked, it is read-only now')
  return board
}

/** Waits for the server to accept a change and for its result to arrive. */
async function sent(ack: Promise<Ack>): Promise<void> {
  const res = await ack
  if (!res.ok) throw new Error(res.message)
  await nextPatch()
}

/** Looks up whether an id is an item or a group. */
function refOf(id: unknown): EntryRef {
  if (typeof id !== 'string') throw new Error('Expected an item or group id')
  if (get().items[id]) return { type: 'item', id }
  if (get().groups[id]) return { type: 'group', id }
  throw new Error(`There is no item or group with id ${id}`)
}

function itemId(id: unknown): string {
  const ref = refOf(id)
  if (ref.type !== 'item') throw new Error(`${ref.id} is a group, not an item`)
  return ref.id
}

function groupId(id: unknown): string {
  const ref = refOf(id)
  if (ref.type !== 'group') throw new Error(`${ref.id} is an item, not a group`)
  return ref.id
}

function column(value: unknown): ColumnKey {
  if (!COLUMNS.includes(value as ColumnKey)) {
    throw new Error(`column must be one of ${COLUMNS.join(', ')}`)
  }
  return value as ColumnKey
}

function text(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) throw new Error('text must not be empty')
  if (trimmed.length > LIMITS.itemText) {
    throw new Error(`text must be at most ${LIMITS.itemText} characters`)
  }
  return trimmed
}

/** Where an action item may hang: an item or group in "To improve". */
function linkTarget(id: unknown): EntryRef {
  const ref = refOf(id)
  const at = ref.type === 'item' ? get().items[ref.id]?.column : get().groups[ref.id]?.column
  if (at !== model.LINK_TARGET) {
    throw new Error(`Action items can only address entries in the "${model.LINK_TARGET}" column`)
  }
  return ref
}

/** Posts like the person would: with their nickname unless they post anonymously. */
function identity(anonymous: unknown) {
  const me = useMe.getState()
  return {
    anonymous: typeof anonymous === 'boolean' ? anonymous : me.anonymous,
    nickname: me.nickname,
  }
}

const anonymousProp = {
  type: 'boolean',
  description:
    "Post without a name. Defaults to the person's own setting; their nickname is used otherwise.",
}

const columnsDoc =
  'Columns: "well" (What went well), "improve" (To improve), "actions" (Action items).'

const tools: WebMcpTool[] = [
  {
    name: 'get_board',
    title: 'Read the retro board',
    description: `Returns the whole retrospective board as JSON: title, whether it is locked, and per column its entries in display order. An entry is an item, or a group of items with a title. Items carry their id, text, author (null = anonymous), votes, whether they are mine, and for action items which "To improve" entry they address. ${columnsDoc} While the timer hides items, other people's texts are null. Call this first to learn the ids the other tools need.`,
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      const board = readyBoard()
      const { timerEndsAt } = get()
      const hidden = timerEndsAt !== null && !!board.timer?.hideItems
      return model.boardAsJson(data(), board, hidden)
    },
  },
  {
    name: 'add_item',
    title: 'Add an item',
    description: `Adds an item to the top of a column. ${columnsDoc} For action items, prefer add_action_item, which can also tie the item to what it addresses.`,
    inputSchema: {
      type: 'object',
      properties: {
        column: { type: 'string', enum: [...COLUMNS] },
        text: { type: 'string', maxLength: LIMITS.itemText },
        anonymous: anonymousProp,
      },
      required: ['column', 'text'],
    },
    async execute(input) {
      writableBoard()
      const who = identity(input.anonymous)
      const { id, sent: ack } = actions.createItem(
        column(input.column),
        text(input.text),
        who.anonymous,
        who.nickname,
      )
      await sent(ack)
      return { id }
    },
  },
  {
    name: 'add_action_item',
    title: 'Add an action item',
    description:
      'Adds an action item (a concrete next step) to the "actions" column. Pass `addresses` with the id of an item or group in the "improve" column to tie the action item to the problem it solves; it then hangs on a string from it on the board.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', maxLength: LIMITS.itemText },
        addresses: {
          type: 'string',
          description: 'Id of an item or group in the "improve" column this action item solves',
        },
        anonymous: anonymousProp,
      },
      required: ['text'],
    },
    async execute(input) {
      writableBoard()
      const target = input.addresses === undefined ? null : linkTarget(input.addresses)
      const who = identity(input.anonymous)
      const { id, sent: ack } = actions.createItem(
        model.LINK_SOURCE,
        text(input.text),
        who.anonymous,
        who.nickname,
        target,
      )
      await sent(ack)
      return { id }
    },
  },
  {
    name: 'link_action_item',
    title: 'Tie an action item to what it addresses',
    description:
      'Ties an existing action item to the item or group in the "improve" column it addresses. Pass `addresses: null` to cut the tie.',
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Id of an item in the "actions" column' },
        addresses: { type: ['string', 'null'] },
      },
      required: ['itemId', 'addresses'],
    },
    async execute(input) {
      writableBoard()
      const id = itemId(input.itemId)
      if (get().items[id]?.column !== model.LINK_SOURCE) {
        throw new Error('Only items in the "actions" column can be tied')
      }
      await sent(actions.link(id, input.addresses === null ? null : linkTarget(input.addresses)))
      return { ok: true }
    },
  },
  {
    name: 'edit_item',
    title: 'Edit an item',
    description: "Replaces an item's text. Only works on the person's own items (mine: true).",
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        text: { type: 'string', maxLength: LIMITS.itemText },
      },
      required: ['itemId', 'text'],
    },
    async execute(input) {
      writableBoard()
      const item = get().items[itemId(input.itemId)]!
      if (!item.mine) throw new Error('Only your own items (mine: true) can be edited')
      const nickname = item.nickname ?? useMe.getState().nickname
      await sent(actions.updateItem(item.id, text(input.text), item.nickname === null, nickname))
      return { ok: true }
    },
  },
  {
    name: 'delete_item',
    title: 'Delete an item',
    description:
      "Deletes an item for everyone. Only works on the person's own items (mine: true), unless they own the board.",
    inputSchema: {
      type: 'object',
      properties: { itemId: { type: 'string' } },
      required: ['itemId'],
    },
    annotations: { consequentialHint: true },
    async execute(input) {
      writableBoard()
      await sent(actions.deleteItem(itemId(input.itemId)))
      return { ok: true }
    },
  },
  {
    name: 'merge',
    title: 'Merge items into a group',
    description:
      'Merges an item or group (`sourceId`) into another item or group (`targetId`), e.g. to cluster items about the same topic. Merging onto a standalone item creates a new group; merging onto a grouped item or a group adds to that group. Returns the id of the resulting group, which you can name with rename_group.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'Item or group to move' },
        targetId: { type: 'string', description: 'Item or group to merge into' },
      },
      required: ['sourceId', 'targetId'],
    },
    async execute(input) {
      writableBoard()
      const source = refOf(input.sourceId)
      const target = refOf(input.targetId)
      if (source.id === target.id) throw new Error('Cannot merge an entry into itself')
      const moving =
        source.type === 'item'
          ? [source.id]
          : model.groupMembers(data(), source.id).map((i) => i.id)
      await sent(actions.merge(source, target))
      return { groupId: get().items[moving[0] ?? '']?.groupId ?? null }
    },
  },
  {
    name: 'rename_group',
    title: 'Name a group',
    description: 'Sets the title of a group. Pass `title: null` to clear it.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        title: { type: ['string', 'null'], maxLength: LIMITS.groupTitle },
      },
      required: ['groupId', 'title'],
    },
    async execute(input) {
      writableBoard()
      const id = groupId(input.groupId)
      const title =
        typeof input.title === 'string' ? input.title.trim().slice(0, LIMITS.groupTitle) : ''
      await sent(actions.renameGroup(id, title || null))
      return { ok: true }
    },
  },
  {
    name: 'ungroup',
    title: 'Dissolve a group',
    description: 'Dissolves a group; its items stay in the column, one by one.',
    inputSchema: {
      type: 'object',
      properties: { groupId: { type: 'string' } },
      required: ['groupId'],
    },
    async execute(input) {
      writableBoard()
      await sent(actions.ungroup(groupId(input.groupId)))
      return { ok: true }
    },
  },
  {
    name: 'move',
    title: 'Move or reorder an entry',
    description: `Moves an item or a whole group to a column, placed right after the entry \`afterId\` (omit or null = at the top). Columns and groups are shown sorted by votes, so this only orders entries with the same votes. An item can also be put into a group with \`groupId\` (then \`afterId\` is an item in that group). ${columnsDoc}`,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Item or group to move' },
        column: { type: 'string', enum: [...COLUMNS] },
        groupId: { type: ['string', 'null'], description: 'Items only: the group to put it in' },
        afterId: { type: ['string', 'null'] },
      },
      required: ['id', 'column'],
    },
    async execute(input) {
      writableBoard()
      const ref = refOf(input.id)
      const to = column(input.column)
      const afterId = input.afterId ? refOf(input.afterId).id : null
      if (ref.type === 'group') {
        if (input.groupId) throw new Error('Groups cannot be put into other groups; use merge')
        await sent(actions.moveGroup(ref.id, to, afterId))
      } else {
        const into = input.groupId ? groupId(input.groupId) : null
        await sent(actions.moveItem(ref.id, to, into, afterId))
      }
      return { ok: true }
    },
  },
]

/** Offers the board tools to a browser agent, if there is one; returns the cleanup. */
export const registerBoardTools = () => registerTools(tools)

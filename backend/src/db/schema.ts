import { sql } from 'drizzle-orm'
import {
  index,
  type AnyPgColumn,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { COLUMNS, LIMITS } from '@retromode/shared'

export const retroColumn = pgEnum('retro_column', COLUMNS)

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}

export const boards = pgTable(
  'boards',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    ownerClientId: uuid('owner_client_id').notNull(),
    ownerKeyHash: text('owner_key_hash').notNull(),
    /** Votes per person per column */
    voteLimit: integer('vote_limit').notNull().default(LIMITS.defaultVoteLimit),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    ...timestamps,
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('boards_last_activity_idx').on(t.lastActivityAt)],
)

export const groups = pgTable(
  'board_groups',
  {
    id: uuid('id').primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    column: retroColumn('column').notNull(),
    position: text('position').notNull(),
    title: text('title'),
    ...timestamps,
  },
  (t) => [index('groups_board_idx').on(t.boardId)],
)

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    column: retroColumn('column').notNull(),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    position: text('position').notNull(),
    text: text('text').notNull(),
    /** Never sent to other clients */
    authorClientId: uuid('author_client_id').notNull(),
    /** null when posted anonymously */
    authorNickname: text('author_nickname'),
    /** An action item can hang on a string from one item or group it addresses */
    linkedItemId: uuid('linked_item_id').references((): AnyPgColumn => items.id, {
      onDelete: 'set null',
    }),
    linkedGroupId: uuid('linked_group_id').references(() => groups.id, { onDelete: 'set null' }),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('items_board_idx').on(t.boardId),
    index('items_group_idx').on(t.groupId),
    index('items_linked_item_idx').on(t.linkedItemId),
    index('items_linked_group_idx').on(t.linkedGroupId),
  ],
)

export const votes = pgTable(
  'votes',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.clientId] }),
    index('votes_client_idx').on(t.clientId),
  ],
)

export type BoardRow = typeof boards.$inferSelect
export type GroupRow = typeof groups.$inferSelect
export type ItemRow = typeof items.$inferSelect

import { z } from 'zod'
import { COLUMNS, LIMITS } from './constants'

export const columnSchema = z.enum(COLUMNS)
export const idSchema = z.uuid()
export const slugSchema = z.string().regex(/^[A-Za-z0-9_-]{6,32}$/)

const itemText = z.string().trim().min(1).max(LIMITS.itemText)
const nickname = z.string().trim().min(1).max(LIMITS.nickname)

export const createBoardSchema = z.object({
  title: z.string().trim().max(LIMITS.boardTitle).optional(),
  clientId: idSchema,
})

export const boardJoinSchema = z.object({
  slug: slugSchema,
  ownerKey: z.string().max(100).optional(),
})

export const entryRefSchema = z.object({
  type: z.enum(['item', 'group']),
  id: idSchema,
})

export const itemCreateSchema = z.object({
  id: idSchema,
  column: columnSchema,
  text: itemText,
  anonymous: z.boolean(),
  nickname: nickname.optional(),
  /** Only for action items: the "To improve" entry this one addresses. */
  link: entryRefSchema.optional(),
})

export const itemUpdateSchema = z.object({
  itemId: idSchema,
  text: itemText.optional(),
  anonymous: z.boolean().optional(),
  nickname: nickname.optional(),
})

export const itemDeleteSchema = z.object({ itemId: idSchema })

/** Places an item into a column (groupId null) or into a group, right after `afterId` (null = first). */
export const itemMoveSchema = z.object({
  itemId: idSchema,
  column: columnSchema,
  groupId: idSchema.nullable(),
  afterId: idSchema.nullable(),
})

export const groupMergeSchema = z.object({
  source: entryRefSchema,
  target: entryRefSchema,
  /** Used when the merge creates a new group (item onto standalone item). */
  newGroupId: idSchema,
})

export const groupUngroupSchema = z.object({ groupId: idSchema })

export const groupUpdateSchema = z.object({
  groupId: idSchema,
  title: z.string().trim().max(LIMITS.groupTitle).nullable(),
})

export const groupMoveSchema = z.object({
  groupId: idSchema,
  column: columnSchema,
  afterId: idSchema.nullable(),
})

/** Ties an action item to a "To improve" item or group (target null = cut the string). */
export const itemLinkSchema = z.object({
  itemId: idSchema,
  target: entryRefSchema.nullable(),
})

export const voteToggleSchema = z.object({ itemId: idSchema })

export const boardSettingsSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.boardTitle).optional(),
  voteLimit: z.number().int().min(LIMITS.voteLimitMin).max(LIMITS.voteLimitMax).optional(),
  locked: z.boolean().optional(),
})

/** Starts (or restarts) the shared countdown; seconds null stops it. Anyone may do this. */
export const boardTimerSchema = z.object({
  seconds: z.number().int().min(LIMITS.timerMinSeconds).max(LIMITS.timerMaxSeconds).nullable(),
})

export type CreateBoardInput = z.infer<typeof createBoardSchema>
export type BoardJoinInput = z.infer<typeof boardJoinSchema>
export type ItemCreateInput = z.infer<typeof itemCreateSchema>
export type ItemUpdateInput = z.infer<typeof itemUpdateSchema>
export type ItemDeleteInput = z.infer<typeof itemDeleteSchema>
export type ItemMoveInput = z.infer<typeof itemMoveSchema>
export type ItemLinkInput = z.infer<typeof itemLinkSchema>
export type EntryRef = z.infer<typeof entryRefSchema>
export type GroupMergeInput = z.infer<typeof groupMergeSchema>
export type GroupUngroupInput = z.infer<typeof groupUngroupSchema>
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>
export type GroupMoveInput = z.infer<typeof groupMoveSchema>
export type VoteToggleInput = z.infer<typeof voteToggleSchema>
export type BoardSettingsInput = z.infer<typeof boardSettingsSchema>
export type BoardTimerInput = z.infer<typeof boardTimerSchema>

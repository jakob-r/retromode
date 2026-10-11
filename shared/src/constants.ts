export const COLUMNS = ['well', 'improve', 'actions'] as const
export type ColumnKey = (typeof COLUMNS)[number]

export const LIMITS = {
  boardTitle: 80,
  itemText: 500,
  nickname: 30,
  groupTitle: 120,
  voteLimitMin: 1,
  voteLimitMax: 20,
  defaultVoteLimit: 3,
  timerMinSeconds: 10,
  timerMaxSeconds: 60 * 60,
  defaultTimerSeconds: 5 * 60,
} as const

export const ERROR_CODES = [
  'INVALID',
  'NOT_FOUND',
  'NOT_JOINED',
  'FORBIDDEN',
  'LOCKED',
  'VOTE_LIMIT',
  'RATE_LIMITED',
  'INTERNAL',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

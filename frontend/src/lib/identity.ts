/**
 * Browser-based identity: no accounts. The clientId is a secret that proves
 * authorship and counts votes; it is only ever sent on the socket handshake.
 */
const PREFIX = 'retromode:'
const memory = new Map<string, string>()

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return memory.get(key) ?? null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, value)
  } catch {
    if (value === null) memory.delete(key)
    else memory.set(key, value)
  }
}

const readFlag = (key: string) => read(key) === '1'
const writeFlag = (key: string, on: boolean) => write(key, on ? '1' : '0')

function readPositiveInt(key: string): number | undefined {
  const n = Number(read(key))
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/** RFC 4122 v4; works outside secure contexts too (e.g. http://<lan-ip>). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function getClientId(): string {
  let id = read('clientId')
  if (!id) {
    id = uuid()
    write('clientId', id)
  }
  return id
}

export const getNickname = () => read('nickname')
export const setNickname = (name: string | null) => write('nickname', name?.trim() || null)

export const hasAnsweredNickname = () => readFlag('nicknameAsked')
export const markNicknameAnswered = () => writeFlag('nicknameAsked', true)

export const getAnonymousPref = () => readFlag('anonymous')
export const setAnonymousPref = (anonymous: boolean) => writeFlag('anonymous', anonymous)

/** Board-creator defaults, remembered for the next board */
export const getVoteLimitPref = () => readPositiveInt('voteLimit')
export const setVoteLimitPref = (limit: number) => write('voteLimit', String(limit))

export const getTimerSecondsPref = () => readPositiveInt('timerSeconds')
export const setTimerSecondsPref = (seconds: number) => write('timerSeconds', String(seconds))

export const getTimerHideItemsPref = () => readFlag('timerHideItems')
export const setTimerHideItemsPref = (hide: boolean) => writeFlag('timerHideItems', hide)

export const getOwnerKey = (slug: string) => read(`ownerKey:${slug}`) ?? undefined
export const setOwnerKey = (slug: string, key: string) => write(`ownerKey:${slug}`, key)
export const forgetOwnerKey = (slug: string) => write(`ownerKey:${slug}`, null)

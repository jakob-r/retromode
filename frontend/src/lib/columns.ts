import type { CSSProperties } from 'react'
import type { ColumnKey } from '@retromode/shared'

export interface ColumnMeta {
  key: ColumnKey
  title: string
  emoji: string
  placeholder: string
  accent: string
  tint: string
  deep: string
}

export const COLUMN_META: Record<ColumnKey, ColumnMeta> = {
  well: {
    key: 'well',
    title: 'What went well',
    emoji: '🌈',
    placeholder: 'What made you smile?',
    accent: 'var(--color-mint)',
    tint: 'var(--color-mint-tint)',
    deep: 'var(--color-mint-deep)',
  },
  improve: {
    key: 'improve',
    title: 'To improve',
    emoji: '🔧',
    placeholder: 'What could be better?',
    accent: 'var(--color-coral)',
    tint: 'var(--color-coral-tint)',
    deep: 'var(--color-coral-deep)',
  },
  actions: {
    key: 'actions',
    title: 'Action items',
    emoji: '🚀',
    placeholder: 'What will we do next?',
    accent: 'var(--color-violet)',
    tint: 'var(--color-violet-tint)',
    deep: 'var(--color-violet-deep)',
  },
}

/** CSS variables that theme everything inside a column. */
export function accentVars(column: ColumnKey): CSSProperties {
  const meta = COLUMN_META[column]
  return {
    '--accent': meta.accent,
    '--accent-tint': meta.tint,
    '--accent-deep': meta.deep,
  } as CSSProperties
}

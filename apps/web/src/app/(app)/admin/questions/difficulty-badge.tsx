'use client'

import type { Difficulty } from '@bot-arena/shared'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'

const DIFFICULTY_VALUES = ['easy', 'medium', 'hard'] as const satisfies readonly Difficulty[]
const VARIANT = {
  easy: 'success',
  medium: 'secondary',
  hard: 'destructive',
} as const satisfies Record<Difficulty, 'success' | 'secondary' | 'destructive'>

/** The difficulty choices for a select, labelled in the current language. */
export function useDifficultyOptions() {
  const t = useTranslations('Difficulty')
  return DIFFICULTY_VALUES.map((value) => ({ value, label: t(value) }))
}

/** The difficulty is always text, never colour alone. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const t = useTranslations('Difficulty')
  return <Badge variant={VARIANT[difficulty]}>{t(difficulty)}</Badge>
}

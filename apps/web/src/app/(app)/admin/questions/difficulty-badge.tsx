import type { Difficulty } from '@bot-arena/shared'
import { Badge } from '@/components/ui/badge'

const LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const satisfies Record<
  Difficulty,
  string
>
const VARIANT = {
  easy: 'success',
  medium: 'secondary',
  hard: 'destructive',
} as const satisfies Record<Difficulty, 'success' | 'secondary' | 'destructive'>

export const DIFFICULTY_OPTIONS = (['easy', 'medium', 'hard'] as const).map((value) => ({
  value,
  label: LABEL[value],
}))

/** The difficulty is always text, never colour alone. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge variant={VARIANT[difficulty]}>{LABEL[difficulty]}</Badge>
}

import { cn } from '@/lib/utils'

const ROUNDS = 4 // 8 entries -> 4 -> 2 -> 1 winner
const COL = 110
const GAP = 46
const PAD = 12
const CHAMPION = 5 // entry that wins the highlighted path

function slotY(round: number, index: number): number {
  if (round === 0) return PAD + index * GAP
  return (slotY(round - 1, index * 2) + slotY(round - 1, index * 2 + 1)) / 2
}

/**
 * A single-elimination bracket with one path lit up. It is the picture of what the product
 * runs, drawn with the theme colors. Mirrors itself in right-to-left layouts.
 */
export function BracketArt({ className }: { className?: string }) {
  const width = COL * ROUNDS + 40
  const height = PAD * 2 + GAP * 7
  const lines: string[] = []
  const lit: string[] = []

  for (let round = 0; round < ROUNDS - 1; round++) {
    const x = round * COL
    const mid = x + COL / 2
    for (let match = 0; match < 8 >> (round + 1); match++) {
      const a = slotY(round, match * 2)
      const b = slotY(round, match * 2 + 1)
      const out = slotY(round + 1, match)
      lines.push(`M${x} ${a}H${mid}V${b}H${x}M${mid} ${out}H${x + COL}`)
    }
    const from = slotY(round, CHAMPION >> round)
    const to = slotY(round + 1, CHAMPION >> (round + 1))
    lit.push(`M${x} ${from}H${mid}V${to}H${x + COL}`)
  }
  const finalY = slotY(ROUNDS - 1, 0)
  lit.push(`M${(ROUNDS - 1) * COL} ${finalY}H${width - 24}`)

  return (
    <svg
      viewBox={`-4 0 ${width} ${height}`}
      fill="none"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
      className={cn('rtl:-scale-x-100', className)}
    >
      <path d={lines.join('')} stroke="currentColor" opacity="0.28" />
      <path d={lit.join('')} className="stroke-signal" strokeWidth="3" />
      <circle cx={width - 20} cy={finalY} r="6" className="fill-signal" />
    </svg>
  )
}

import { marginalU } from '../../engine/simulate'
import type { MarginalUtil } from '../../types'

/** Tiny preview of a marginal utility curve u(x) between worst and best. */
export function CurvePreview({ m }: { m: MarginalUtil }) {
  const w = 108
  const h = 56
  const pad = 5
  const pts: string[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const x = m.worst + t * (m.best - m.worst)
    const u = marginalU(x, m)
    pts.push(`${pad + t * (w - 2 * pad)},${h - pad - u * (h - 2 * pad)}`)
  }
  return (
    <svg width={w} height={h} className="curve-preview" role="img" aria-label="Marginal utility curve">
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={4} className="curve-frame" />
      <polyline points={pts.join(' ')} className="curve-line" />
    </svg>
  )
}

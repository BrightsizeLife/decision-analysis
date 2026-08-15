import { useState } from 'react'
import type { Summary } from '../../engine/stats'
import { fmtNum, niceTicks } from '../../engine/stats'
import { Tip, TooltipBox, useMeasure } from './common'

export interface IntervalRow {
  id: string
  label: string
  color: string
  s: Summary
}

interface Props {
  rows: IntervalRow[]
  unit?: string
  format?: (v: number) => string
}

/**
 * Uncertainty-interval plot: per decision, a thin 5–95% line, a thick
 * 25–75% band, and a median dot — the standard Bayesian summary of p(x|d).
 */
export function IntervalPlot({ rows, unit, format = fmtNum }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const rowH = 40
  const labelW = Math.min(190, Math.max(110, width * 0.28))
  const pad = { top: 6, right: 20, bottom: 22 }
  const height = pad.top + rows.length * rowH + pad.bottom

  if (width === 0 || rows.length === 0) {
    return <div className="chart" ref={ref} style={{ height }} />
  }

  let lo = Infinity
  let hi = -Infinity
  for (const r of rows) {
    lo = Math.min(lo, r.s.q05)
    hi = Math.max(hi, r.s.q95)
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return <div className="chart" ref={ref} style={{ height }} />
  }
  if (lo === hi) {
    const p = Math.abs(lo) > 1e-12 ? Math.abs(lo) * 0.1 : 0.5
    lo -= p
    hi += p
  }
  const span = hi - lo
  lo -= span * 0.05
  hi += span * 0.05
  const x0 = labelW + 8
  const x1 = width - pad.right
  const x = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0)
  const ticks = niceTicks(lo, hi, Math.max(3, Math.min(6, Math.floor((x1 - x0) / 90))))

  return (
    <div className="chart" ref={ref} style={{ height }}>
      <svg width={width} height={height} role="img" aria-label="Uncertainty intervals by decision">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={pad.top} y2={height - pad.bottom} className="grid-line" />
            <text x={x(t)} y={height - 7} className="tick-label" textAnchor="middle">
              {format(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = pad.top + i * rowH + rowH / 2
          return (
            <g key={r.id}>
              <text x={labelW} y={cy + 4} textAnchor="end" className="bar-label">
                {truncate(r.label, Math.floor(labelW / 7))}
              </text>
              <line x1={x(r.s.q05)} x2={x(r.s.q95)} y1={cy} y2={cy} stroke={r.color} strokeWidth={2} strokeLinecap="round" />
              <line x1={x(r.s.q25)} x2={x(r.s.q75)} y1={cy} y2={cy} stroke={r.color} strokeWidth={7} strokeLinecap="round" />
              <circle cx={x(r.s.q50)} cy={cy} r={5} fill={r.color} className="dot-ring" />
              <rect
                x={0}
                y={pad.top + i * rowH}
                width={width}
                height={rowH}
                fill="transparent"
                onPointerMove={(e) => {
                  const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setTip({
                    x: e.clientX - rect.left,
                    y: cy - 12,
                    title: r.label + (unit ? ` (${unit})` : ''),
                    rows: [
                      { label: 'median', value: format(r.s.q50), color: r.color },
                      { label: 'mean', value: format(r.s.mean) },
                      { label: '50% interval', value: `${format(r.s.q25)} – ${format(r.s.q75)}` },
                      { label: '90% interval', value: `${format(r.s.q05)} – ${format(r.s.q95)}` },
                    ],
                  })
                }}
                onPointerLeave={() => setTip(null)}
              />
            </g>
          )
        })}
      </svg>
      {tip && <TooltipBox tip={tip} width={width} />}
    </div>
  )
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s
}

import { useState } from 'react'
import { fmtNum, niceTicks } from '../../engine/stats'
import { leftRoundedRect, rightRoundedRect, Tip, TooltipBox, useMeasure } from './common'

export interface RankBarItem {
  id: string
  label: string
  value: number
  /** Monte Carlo standard error — drawn as a ±2·SE whisker. */
  se?: number
  color: string
  best?: boolean
  tipRows?: { label: string; value: string }[]
}

interface Props {
  items: RankBarItem[]
  format?: (v: number) => string
}

/** Horizontal bar chart for E[U(x)|d] and similar per-decision magnitudes. */
export function RankBars({ items, format = fmtNum }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const rowH = 36
  const barH = 16
  const labelW = Math.min(190, Math.max(110, width * 0.28))
  const pad = { top: 4, right: 64, bottom: 22 }
  const height = pad.top + items.length * rowH + pad.bottom

  if (width === 0 || items.length === 0) {
    return <div className="chart" ref={ref} style={{ height }} />
  }

  let lo = 0
  let hi = 0
  for (const it of items) {
    const w = 2 * (it.se ?? 0)
    lo = Math.min(lo, it.value - w)
    hi = Math.max(hi, it.value + w)
  }
  if (lo === hi) hi = lo + 1
  const span = hi - lo
  lo -= span * 0.04
  hi += span * 0.04
  const x0 = labelW + 8
  const x1 = width - pad.right
  const x = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0)
  const zeroX = x(Math.max(lo, Math.min(hi, 0)))
  const ticks = niceTicks(lo, hi, Math.max(3, Math.min(6, Math.floor((x1 - x0) / 90))))

  return (
    <div className="chart" ref={ref} style={{ height }}>
      <svg width={width} height={height} role="img" aria-label="Ranked bar chart by decision">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={pad.top} y2={height - pad.bottom} className="grid-line" />
            <text x={x(t)} y={height - 7} className="tick-label" textAnchor="middle">
              {format(t)}
            </text>
          </g>
        ))}
        <line x1={zeroX} x2={zeroX} y1={pad.top} y2={height - pad.bottom} className="axis-line" />
        {items.map((it, i) => {
          const cy = pad.top + i * rowH + rowH / 2
          const by = cy - barH / 2
          const vx = x(it.value)
          const barW = Math.abs(vx - zeroX)
          const d =
            it.value >= 0
              ? rightRoundedRect(zeroX, by, Math.max(barW, 0.5), barH, 4)
              : leftRoundedRect(zeroX, by, Math.max(barW, 0.5), barH, 4)
          const se = it.se ?? 0
          return (
            <g key={it.id}>
              <text
                x={labelW}
                y={cy + 4}
                textAnchor="end"
                className={it.best ? 'bar-label bar-label-best' : 'bar-label'}
              >
                {truncate(it.label, Math.floor(labelW / 7))}
              </text>
              <path d={d} fill={it.color} />
              {se > 0 && (
                <g className="whisker">
                  <line x1={x(it.value - 2 * se)} x2={x(it.value + 2 * se)} y1={cy} y2={cy} />
                  <line x1={x(it.value - 2 * se)} x2={x(it.value - 2 * se)} y1={cy - 4} y2={cy + 4} />
                  <line x1={x(it.value + 2 * se)} x2={x(it.value + 2 * se)} y1={cy - 4} y2={cy + 4} />
                </g>
              )}
              <text x={Math.max(vx, zeroX) + (se > 0 ? Math.max(0, x(it.value + 2 * se) - vx) : 0) + 8} y={cy + 4} className="bar-value">
                {format(it.value)}
                {it.best ? ' ✓' : ''}
              </text>
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
                    y: by - 4,
                    title: it.label,
                    rows: [
                      { label: '', value: format(it.value), color: it.color },
                      ...(se > 0 ? [{ label: '±2·SE (Monte Carlo)', value: `± ${format(2 * se)}` }] : []),
                      ...(it.tipRows ?? []),
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

import { useMemo, useState } from 'react'
import { fmtNum, histogram, niceTicks } from '../../engine/stats'
import { Tip, TooltipBox, topRoundedRect, useMeasure } from './common'

interface Props {
  values: ArrayLike<number>
  color: string
  height?: number
  /** Force a shared x-domain across small multiples. */
  domain?: [number, number]
  unit?: string
  bins?: number
}

/** Single-series histogram with per-bin hover. */
export function Histogram({ values, color, height = 130, domain, unit, bins = 24 }: Props) {
  const [ref, width] = useMeasure<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const data = useMemo(() => histogram(values, bins, domain), [values, bins, domain])
  const total = values.length

  const pad = { top: 6, right: 8, bottom: 20, left: 8 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom

  if (data.length === 0 || width === 0) {
    return (
      <div className="chart" ref={ref} style={{ height }}>
        <div className="chart-empty">no draws</div>
      </div>
    )
  }

  const lo = data[0].x0
  const hi = data[data.length - 1].x1
  const maxCount = Math.max(1, ...data.map((b) => b.count))
  const x = (v: number) => pad.left + ((v - lo) / (hi - lo)) * innerW
  const y = (c: number) => pad.top + innerH * (1 - c / maxCount)
  const ticks = niceTicks(lo, hi, Math.max(3, Math.min(6, Math.floor(innerW / 90))))

  return (
    <div className="chart" ref={ref} style={{ height }}>
      <svg width={width} height={height} role="img" aria-label="Histogram of simulated draws">
        {/* baseline */}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} className="axis-line" />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={height - 5} className="tick-label" textAnchor="middle">
            {fmtNum(t)}
          </text>
        ))}
        {data.map((b, i) => {
          if (b.count === 0) return null
          const bx = x(b.x0)
          const bw = Math.max(1, x(b.x1) - x(b.x0) - 2)
          const by = y(b.count)
          const bh = pad.top + innerH - by
          return <path key={i} d={topRoundedRect(bx, by, bw, Math.max(0.5, bh), 2)} fill={color} />
        })}
        {/* full-height hit targets, one per bin */}
        {data.map((b, i) => (
          <rect
            key={`h${i}`}
            x={x(b.x0)}
            y={pad.top}
            width={Math.max(1, x(b.x1) - x(b.x0))}
            height={innerH}
            fill="transparent"
            onPointerMove={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
              setTip({
                x: e.clientX - rect.left,
                y: Math.max(10, y(b.count) - 6),
                title: `${fmtNum(b.x0)} – ${fmtNum(b.x1)}${unit ? ` ${unit}` : ''}`,
                rows: [{ label: 'of draws', value: total ? `${((b.count / total) * 100).toFixed(1)}%` : '0%' }],
              })
            }}
            onPointerLeave={() => setTip(null)}
          />
        ))}
      </svg>
      {tip && <TooltipBox tip={tip} width={width} />}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type React from 'react'

/** Measure a container's width so SVG charts render at exact pixel size. */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width)
    })
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export interface TipRow {
  label: string
  value: string
  color?: string
}

export interface Tip {
  x: number
  y: number
  title?: string
  rows: TipRow[]
}

/** Shared tooltip box. Values lead; series identity is a short color key. */
export function TooltipBox({ tip, width }: { tip: Tip; width: number }) {
  const left = Math.min(Math.max(tip.x, 70), Math.max(70, width - 70))
  return (
    <div className="chart-tip" style={{ left, top: tip.y }} role="status">
      {tip.title !== undefined && <div className="chart-tip-title">{tip.title}</div>}
      {tip.rows.map((r, i) => (
        <div className="chart-tip-row" key={i}>
          {r.color && <span className="chart-tip-key" style={{ background: r.color }} />}
          <span className="chart-tip-value">{r.value}</span>
          <span className="chart-tip-label">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

/** CSS variable for a decision's categorical color slot (0-based). */
export function seriesVar(slot: number): string {
  return `var(--series-${(slot % 8) + 1})`
}

/** Bar path: 4px-rounded data end, square at the baseline (vertical bars). */
export function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  return [
    `M${x},${y + h}`,
    `L${x},${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ')
}

/** Horizontal bar growing right from x: rounded data end on the right. */
export function rightRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h / 2, w))
  return [
    `M${x},${y}`,
    `L${x + w - rr},${y}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `L${x + w},${y + h - rr}`,
    `Q${x + w},${y + h} ${x + w - rr},${y + h}`,
    `L${x},${y + h}`,
    'Z',
  ].join(' ')
}

/** Horizontal bar growing left from x (for negative values). */
export function leftRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, h / 2, w))
  return [
    `M${x},${y}`,
    `L${x - w + rr},${y}`,
    `Q${x - w},${y} ${x - w},${y + rr}`,
    `L${x - w},${y + h - rr}`,
    `Q${x - w},${y + h} ${x - w + rr},${y + h}`,
    `L${x},${y + h}`,
    'Z',
  ].join(' ')
}

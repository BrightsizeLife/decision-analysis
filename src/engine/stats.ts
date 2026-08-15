export function mean(a: ArrayLike<number>): number {
  if (a.length === 0) return NaN
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]
  return s / a.length
}

export function sd(a: ArrayLike<number>): number {
  if (a.length < 2) return 0
  const m = mean(a)
  let s = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - m
    s += d * d
  }
  return Math.sqrt(s / (a.length - 1))
}

export function sortedCopy(a: ArrayLike<number>): Float64Array {
  const out = Float64Array.from(a as ArrayLike<number>)
  out.sort()
  return out
}

/** Quantile of an already-sorted array, with linear interpolation. */
export function quantileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length
  if (n === 0) return NaN
  if (n === 1) return sorted[0]
  const h = (n - 1) * Math.min(1, Math.max(0, p))
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo)
}

export interface Summary {
  n: number
  mean: number
  sd: number
  min: number
  max: number
  q05: number
  q25: number
  q50: number
  q75: number
  q95: number
}

export function summarize(a: ArrayLike<number>): Summary {
  const s = sortedCopy(a)
  return {
    n: s.length,
    mean: mean(s),
    sd: sd(s),
    min: s.length ? s[0] : NaN,
    max: s.length ? s[s.length - 1] : NaN,
    q05: quantileSorted(s, 0.05),
    q25: quantileSorted(s, 0.25),
    q50: quantileSorted(s, 0.5),
    q75: quantileSorted(s, 0.75),
    q95: quantileSorted(s, 0.95),
  }
}

export interface HistBin {
  x0: number
  x1: number
  count: number
}

export function histogram(
  values: ArrayLike<number>,
  binCount = 24,
  domain?: [number, number],
): HistBin[] {
  if (values.length === 0) return []
  let lo = Infinity
  let hi = -Infinity
  if (domain) {
    lo = domain[0]
    hi = domain[1]
  } else {
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return []
  if (lo === hi) {
    // Degenerate (point mass): one bin centered on the value.
    const pad = Math.abs(lo) > 1e-12 ? Math.abs(lo) * 0.05 : 0.5
    lo -= pad
    hi += pad
  }
  const bins: HistBin[] = []
  const w = (hi - lo) / binCount
  for (let b = 0; b < binCount; b++) {
    bins.push({ x0: lo + b * w, x1: lo + (b + 1) * w, count: 0 })
  }
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v < lo || v > hi) continue
    let b = Math.floor((v - lo) / w)
    if (b >= binCount) b = binCount - 1
    if (b < 0) b = 0
    bins[b].count++
  }
  return bins
}

/** Clean tick values covering [min, max] — the classic nice-numbers loop. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) {
    const pad = Math.abs(min) > 1e-12 ? Math.abs(min) * 0.05 : 0.5
    min -= pad
    max += pad
  }
  const span = max - min
  const step0 = span / Math.max(1, target)
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 1e-6; v += step) {
    // Snap floating point noise (e.g. 0.30000000000000004).
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : Number(v.toPrecision(12)))
  }
  return ticks
}

/** Compact, adaptive number formatting for labels and table cells. */
export function fmtNum(v: number, maxDecimals?: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e9) return trimZeros((v / 1e9).toFixed(abs >= 1e10 ? 0 : 1)) + 'B'
  if (abs >= 1e6) return trimZeros((v / 1e6).toFixed(abs >= 1e7 ? 0 : 1)) + 'M'
  if (abs >= 1e4) return Math.round(v).toLocaleString('en-US')
  let dec: number
  if (maxDecimals !== undefined) dec = maxDecimals
  else if (abs >= 100) dec = 0
  else if (abs >= 1) dec = 2
  else if (abs === 0) dec = 0
  else dec = Math.min(6, 2 - Math.floor(Math.log10(abs)))
  const s = v.toFixed(dec)
  return trimZeros(abs >= 1000 ? Number(s).toLocaleString('en-US', { maximumFractionDigits: dec }) : s)
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s
  return s.replace(/\.?0+$/, '')
}

/** Format a probability as a percentage. */
export function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return '—'
  const v = p * 100
  if (v > 0 && v < 1) return '<1%'
  if (v > 99 && v < 100) return '>99%'
  return Math.round(v) + '%'
}

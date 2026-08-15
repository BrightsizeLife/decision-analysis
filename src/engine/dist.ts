import type { DistSpec, DistType } from '../types'
import { RNG } from './random'

export const DIST_LABELS: Record<DistType, string> = {
  point: 'Point value (certain)',
  normal: 'Normal',
  lognormal: 'Log-normal',
  uniform: 'Uniform',
  beta: 'Beta (scaled)',
  discrete: 'Discrete',
  samples: 'Posterior draws (paste)',
}

/** Parse whitespace/comma-separated numbers from pasted text. */
export function parseNumbers(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .filter((t) => t.length > 0)
    .map(Number)
    .filter((v) => Number.isFinite(v))
}

export interface SampleResult {
  draws: Float64Array
  issues: string[]
}

export function sampleDist(spec: DistSpec, rng: RNG, n: number): SampleResult {
  const out = new Float64Array(n)
  const issues: string[] = []
  switch (spec.type) {
    case 'point': {
      out.fill(spec.value)
      break
    }
    case 'normal': {
      if (spec.sd < 0) issues.push('Normal sd is negative; using |sd|.')
      const s = Math.abs(spec.sd)
      for (let i = 0; i < n; i++) out[i] = spec.mean + s * rng.normal()
      break
    }
    case 'lognormal': {
      if (spec.median <= 0) {
        issues.push('Log-normal median must be > 0; falling back to a point at 0.')
        break
      }
      if (spec.sigma < 0) issues.push('Log-normal sigma is negative; using |sigma|.')
      const mu = Math.log(spec.median)
      const s = Math.abs(spec.sigma)
      for (let i = 0; i < n; i++) out[i] = Math.exp(mu + s * rng.normal())
      break
    }
    case 'uniform': {
      const lo = Math.min(spec.min, spec.max)
      const hi = Math.max(spec.min, spec.max)
      for (let i = 0; i < n; i++) out[i] = lo + (hi - lo) * rng.next()
      break
    }
    case 'beta': {
      if (spec.alpha <= 0 || spec.beta <= 0) {
        issues.push('Beta shape parameters must be > 0; falling back to a point at min.')
        out.fill(spec.min)
        break
      }
      const lo = Math.min(spec.min, spec.max)
      const hi = Math.max(spec.min, spec.max)
      for (let i = 0; i < n; i++) out[i] = lo + (hi - lo) * rng.beta(spec.alpha, spec.beta)
      break
    }
    case 'discrete': {
      const rows = spec.rows.filter((r) => Number.isFinite(r.value) && r.prob > 0)
      if (rows.length === 0) {
        issues.push('Discrete distribution has no rows with positive probability; using 0.')
        break
      }
      const total = rows.reduce((s, r) => s + r.prob, 0)
      if (Math.abs(total - 1) > 1e-6) {
        issues.push(`Discrete probabilities sum to ${total.toPrecision(3)}; normalized to 1.`)
      }
      const cdf: number[] = []
      let acc = 0
      for (const r of rows) {
        acc += r.prob / total
        cdf.push(acc)
      }
      for (let i = 0; i < n; i++) {
        const u = rng.next()
        let k = 0
        while (k < cdf.length - 1 && u > cdf[k]) k++
        out[i] = rows[k].value
      }
      break
    }
    case 'samples': {
      const vals = parseNumbers(spec.raw)
      if (vals.length === 0) {
        issues.push('No numeric draws pasted yet; using 0.')
        break
      }
      // Bootstrap-resample the pasted posterior draws up to n.
      for (let i = 0; i < n; i++) out[i] = vals[Math.floor(rng.next() * vals.length)]
      break
    }
  }
  return { draws: out, issues }
}

/** One-line description of a spec, for compact cell summaries. */
export function distLabel(spec: DistSpec): string {
  switch (spec.type) {
    case 'point':
      return `exactly ${spec.value}`
    case 'normal':
      return `Normal(${spec.mean}, ${spec.sd})`
    case 'lognormal':
      return `LogNormal(median ${spec.median}, σ ${spec.sigma})`
    case 'uniform':
      return `Uniform(${spec.min}, ${spec.max})`
    case 'beta':
      return `Beta(${spec.alpha}, ${spec.beta}) on [${spec.min}, ${spec.max}]`
    case 'discrete':
      return `Discrete, ${spec.rows.length} values`
    case 'samples': {
      const k = parseNumbers(spec.raw).length
      return k > 0 ? `${k.toLocaleString('en-US')} pasted draws` : 'no draws pasted'
    }
  }
}

export function defaultSpecFor(type: DistType, prev?: DistSpec): DistSpec {
  // Carry a reasonable center over from the previous spec when switching type.
  const center = prev ? specCenter(prev) : 0
  switch (type) {
    case 'point':
      return { type: 'point', value: center }
    case 'normal':
      return { type: 'normal', mean: center, sd: Math.max(1, Math.abs(center) * 0.2) }
    case 'lognormal':
      return { type: 'lognormal', median: center > 0 ? center : 1, sigma: 0.5 }
    case 'uniform':
      return { type: 'uniform', min: center - 1, max: center + 1 }
    case 'beta':
      return { type: 'beta', alpha: 2, beta: 2, min: 0, max: center > 0 ? center * 2 : 1 }
    case 'discrete':
      return { type: 'discrete', rows: [{ value: center, prob: 0.5 }, { value: center + 1, prob: 0.5 }] }
    case 'samples':
      return { type: 'samples', raw: '' }
  }
}

function specCenter(spec: DistSpec): number {
  switch (spec.type) {
    case 'point':
      return spec.value
    case 'normal':
      return spec.mean
    case 'lognormal':
      return spec.median
    case 'uniform':
      return (spec.min + spec.max) / 2
    case 'beta':
      return (spec.min + spec.max) / 2
    case 'discrete':
      return spec.rows.length ? spec.rows[0].value : 0
    case 'samples': {
      const vals = parseNumbers(spec.raw)
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    }
  }
}

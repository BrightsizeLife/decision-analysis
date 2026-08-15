// Seeded RNG so simulations are reproducible: same project + seed -> same draws.

/** FNV-1a 32-bit string hash, used to derive per-(decision, outcome) seeds. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export class RNG {
  private s: number
  private spare: number | null = null

  constructor(seed: number) {
    this.s = seed >>> 0
    if (this.s === 0) this.s = 0x9e3779b9
  }

  /** Uniform on [0, 1) — mulberry32. */
  next(): number {
    let t = (this.s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Standard normal — Box–Muller with a cached spare. */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare
      this.spare = null
      return v
    }
    let u = 0
    do {
      u = this.next()
    } while (u <= 1e-12)
    const v = this.next()
    const r = Math.sqrt(-2 * Math.log(u))
    const a = 2 * Math.PI * v
    this.spare = r * Math.sin(a)
    return r * Math.cos(a)
  }

  /** Gamma(alpha, 1) — Marsaglia–Tsang, with the alpha < 1 boost. */
  gamma(alpha: number): number {
    if (alpha < 1) {
      let u = this.next()
      if (u <= 1e-12) u = 1e-12
      return this.gamma(alpha + 1) * Math.pow(u, 1 / alpha)
    }
    const d = alpha - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    for (;;) {
      let x: number
      let v: number
      do {
        x = this.normal()
        v = 1 + c * x
      } while (v <= 0)
      v = v * v * v
      const u = this.next()
      if (u < 1 - 0.0331 * x * x * x * x) return d * v
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
  }

  beta(a: number, b: number): number {
    const x = this.gamma(a)
    const y = this.gamma(b)
    return x / (x + y)
  }
}

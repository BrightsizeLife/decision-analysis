// Step 4 of the analysis: simulate x ~ p(x|d) for every decision, push the
// draws through U(x), and estimate E[U(x)|d] by Monte Carlo.

import type { MarginalUtil, Project } from '../types'
import { defaultDist } from '../types'
import { RNG, hashString } from './random'
import { sampleDist } from './dist'
import { parseJointCsv } from './joint'
import { compileExpr } from './expr'

/** Variable name an outcome gets inside custom formulas and CSV matching. */
export function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = s || 'x'
  return /^[0-9]/.test(base) ? 'x_' + base : base
}

/** Unique variable name per outcome id (collisions get a numeric suffix). */
export function outcomeVarNames(outcomes: Project['outcomes']): Record<string, string> {
  const used = new Map<string, number>()
  const out: Record<string, string> = {}
  for (const o of outcomes) {
    const base = slugify(o.name)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    out[o.id] = count === 0 ? base : `${base}_${count + 1}`
  }
  return out
}

export interface DecisionSim {
  n: number
  draws: Record<string, Float64Array> // by outcome id
  utility: Float64Array | null
  issues: string[]
}

export interface SimResult {
  byDecision: Record<string, DecisionSim>
  /** P(decision d has the highest utility), estimated over common draw indices. */
  pBest: Record<string, number> | null
  issues: string[]
}

export function marginalU(x: number, m: MarginalUtil): number {
  const span = m.best - m.worst
  if (span === 0) return 0.5
  let t = (x - m.worst) / span
  t = Math.max(0, Math.min(1, t))
  const r = m.curvature
  if (Math.abs(r) < 1e-9) return t
  return (1 - Math.exp(-r * t)) / (1 - Math.exp(-r))
}

export function simulate(project: Project, includeUtility: boolean): SimResult {
  const { decisions, outcomes, models, seed, utility } = project
  const n = Math.max(100, Math.min(50000, Math.floor(project.nDraws) || 4000))
  const byDecision: Record<string, DecisionSim> = {}
  const globalIssues: string[] = []
  const varNames = outcomeVarNames(outcomes)

  // --- Step 2: draw x ~ p(x|d) for each decision --------------------------
  for (const d of decisions) {
    const model = models[d.id] ?? { mode: 'independent' as const, cells: {}, jointCsv: '' }
    const issues: string[] = []
    const draws: Record<string, Float64Array> = {}
    let fromJoint = new Set<string>()

    if (model.mode === 'joint' && model.jointCsv.trim()) {
      const parsed = parseJointCsv(model.jointCsv, outcomes)
      if (parsed.ok) {
        // Bootstrap whole rows so dependence between attributes is kept.
        const rng = new RNG(hashString(`${seed}:${d.id}:joint`))
        const idx = new Int32Array(n)
        for (let i = 0; i < n; i++) idx[i] = Math.floor(rng.next() * parsed.nRows)
        for (const [oid, col] of Object.entries(parsed.cols)) {
          const arr = new Float64Array(n)
          for (let i = 0; i < n; i++) arr[i] = col[idx[i]]
          draws[oid] = arr
          fromJoint.add(oid)
        }
        if (parsed.skippedRows > 0) issues.push(`${parsed.skippedRows} pasted row(s) had non-numeric cells and were skipped.`)
        for (const oid of parsed.unmatched) {
          const o = outcomes.find((x) => x.id === oid)
          if (o) issues.push(`No pasted column matched “${o.name}”; using its specified distribution instead.`)
        }
      } else if (parsed.error) {
        issues.push(`Joint draws not used: ${parsed.error}`)
      }
    }

    for (const o of outcomes) {
      if (fromJoint.has(o.id)) continue
      const spec = model.cells[o.id] ?? defaultDist()
      const rng = new RNG(hashString(`${seed}:${d.id}:${o.id}`))
      const r = sampleDist(spec, rng, n)
      draws[o.id] = r.draws
      for (const msg of r.issues) issues.push(`${o.name}: ${msg}`)
    }

    byDecision[d.id] = { n, draws, utility: null, issues }
  }

  // --- Step 3 applied: U(x) per draw ---------------------------------------
  if (includeUtility && outcomes.length > 0) {
    if (utility.mode === 'identity') {
      const oid = utility.identityOutcomeId ?? outcomes[0].id
      const exists = outcomes.some((o) => o.id === oid)
      const target = exists ? oid : outcomes[0].id
      for (const d of decisions) {
        const sim = byDecision[d.id]
        sim.utility = Float64Array.from(sim.draws[target] ?? new Float64Array(n))
      }
    } else if (utility.mode === 'weighted') {
      const entries = outcomes
        .map((o) => ({ o, m: utility.weighted[o.id] }))
        .filter((e): e is { o: (typeof outcomes)[number]; m: MarginalUtil } => e.m !== undefined)
      const totalW = entries.reduce((s, e) => s + Math.max(0, e.m.weight), 0)
      if (entries.length === 0 || totalW <= 0) {
        globalIssues.push('Weighted utility needs at least one outcome with a positive weight.')
      } else {
        for (const e of entries) {
          if (e.m.weight < 0) globalIssues.push(`Weight for “${e.o.name}” is negative; treated as 0.`)
          if (e.m.best === e.m.worst) globalIssues.push(`“${e.o.name}”: utility-0 and utility-1 values are equal, so it contributes a constant 0.5.`)
        }
        for (const d of decisions) {
          const sim = byDecision[d.id]
          const u = new Float64Array(n)
          for (const e of entries) {
            const w = Math.max(0, e.m.weight) / totalW
            if (w === 0) continue
            const xs = sim.draws[e.o.id]
            for (let i = 0; i < n; i++) u[i] += w * marginalU(xs[i], e.m)
          }
          sim.utility = u
        }
      }
    } else {
      // Custom formula.
      const allowed = new Set(Object.values(varNames))
      const compiled = compileExpr(utility.formula, allowed)
      if (!compiled.ok) {
        globalIssues.push(`Utility formula: ${compiled.error}`)
      } else {
        for (const d of decisions) {
          const sim = byDecision[d.id]
          const u = new Float64Array(n)
          const vars: Record<string, number> = {}
          let bad = 0
          for (let i = 0; i < n; i++) {
            for (const o of outcomes) vars[varNames[o.id]] = sim.draws[o.id][i]
            const v = compiled.expr.eval(vars)
            if (Number.isFinite(v)) {
              u[i] = v
            } else {
              u[i] = 0
              bad++
            }
          }
          if (bad > 0) sim.issues.push(`Utility formula produced ${bad} non-finite value(s) (treated as 0) — check for log/√ of negatives or division by zero.`)
          sim.utility = u
        }
      }
    }
  }

  // --- Step 4: which d wins, and how often ---------------------------------
  let pBest: Record<string, number> | null = null
  const withU = decisions.filter((d) => byDecision[d.id].utility !== null)
  if (includeUtility && withU.length >= 2) {
    pBest = {}
    for (const d of withU) pBest[d.id] = 0
    for (let i = 0; i < n; i++) {
      let best = -Infinity
      for (const d of withU) {
        const v = byDecision[d.id].utility![i]
        if (v > best) best = v
      }
      const winners = withU.filter((d) => byDecision[d.id].utility![i] === best)
      for (const w of winners) pBest[w.id] += 1 / winners.length
    }
    for (const d of withU) pBest[d.id] /= n
  }

  return { byDecision, pBest, issues: globalIssues }
}

import { useMemo } from 'react'
import type { MarginalUtil, Project, UtilityMode } from '../types'
import { outcomeVarNames, simulate } from '../engine/simulate'
import { compileExpr } from '../engine/expr'
import { summarize } from '../engine/stats'
import { CurvePreview } from './charts/CurvePreview'
import { M, NumField, Seg } from './ui'

export function UtilityStep({
  project,
  update,
}: {
  project: Project
  update: (fn: (p: Project) => Project) => void
}) {
  const varNames = useMemo(() => outcomeVarNames(project.outcomes), [project.outcomes])

  // Simulated (utility-free) draws give sensible default reference points.
  const sim = useMemo(() => simulate(project, false), [project])
  const pooledRange = useMemo(() => {
    const out: Record<string, { lo: number; hi: number }> = {}
    for (const o of project.outcomes) {
      let lo = Infinity
      let hi = -Infinity
      for (const d of project.decisions) {
        const s = summarize(sim.byDecision[d.id]?.draws[o.id] ?? [])
        if (Number.isFinite(s.q05)) lo = Math.min(lo, s.q05)
        if (Number.isFinite(s.q95)) hi = Math.max(hi, s.q95)
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) {
        out[o.id] = { lo: 0, hi: 1 }
      } else {
        out[o.id] = { lo, hi }
      }
    }
    return out
  }, [project.decisions, project.outcomes, sim])

  const getMarginal = (oid: string): MarginalUtil =>
    project.utility.weighted[oid] ?? {
      worst: pooledRange[oid]?.lo ?? 0,
      best: pooledRange[oid]?.hi ?? 1,
      curvature: 0,
      weight: 1,
    }

  const setMarginal = (oid: string, patch: Partial<MarginalUtil>) =>
    update((p) => ({
      ...p,
      utility: { ...p.utility, weighted: { ...p.utility.weighted, [oid]: { ...getMarginal(oid), ...patch } } },
    }))

  const singleOutcome = project.outcomes.length === 1
  const mode = project.utility.mode
  const setMode = (m: UtilityMode) => update((p) => ({ ...p, utility: { ...p.utility, mode: m } }))

  const totalWeight = project.outcomes.reduce((s, o) => s + Math.max(0, getMarginal(o.id).weight), 0)

  const compiled = useMemo(() => {
    if (mode !== 'formula') return null
    return compileExpr(project.utility.formula, new Set(Object.values(varNames)))
  }, [mode, project.utility.formula, varNames])

  if (project.outcomes.length === 0) {
    return (
      <div className="step">
        <header className="step-intro">
          <h2>
            Step 3 · Define the utility function <M>U(x)</M>
          </h2>
          <p className="empty-hint">Add at least one outcome in step 1 first.</p>
        </header>
      </div>
    )
  }

  return (
    <div className="step">
      <header className="step-intro">
        <h2>
          Step 3 · Define the utility function <M>U(x)</M>
        </h2>
        <p>
          Utility maps each outcome vector onto a single number — the relative value of one <M>x</M> against another.
          With one outcome, <M>U</M> can simply be that outcome. With several, this is where trade-offs are made
          explicit: how much free time is a dollar worth? Curvature encodes risk attitude — concave means a certain
          middling outcome beats a risky spread with the same mean.
        </p>
      </header>

      <Seg
        value={mode}
        onChange={setMode}
        options={[
          {
            value: 'identity',
            label: 'Outcome as-is',
            title: singleOutcome ? 'Use the single outcome directly as utility' : 'Use one outcome directly; the others are ignored',
          },
          { value: 'weighted', label: 'Weighted trade-off', title: 'Value each attribute on a 0–1 scale, then combine with swing weights' },
          { value: 'formula', label: 'Custom formula', title: 'Write U(x) yourself as an arithmetic expression' },
        ]}
      />

      {mode === 'identity' && (
        <section className="card">
          <p>
            <M>U(x) = </M>{' '}
            <select
              value={project.utility.identityOutcomeId ?? project.outcomes[0].id}
              aria-label="Outcome used as utility"
              onChange={(e) => update((p) => ({ ...p, utility: { ...p.utility, identityOutcomeId: e.target.value } }))}
            >
              {project.outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </p>
          <p className="card-hint">
            Expected utility is then just the expected value of this outcome
            {singleOutcome ? '.' : ' — the other attributes are ignored. Use a weighted trade-off to include them.'}
          </p>
        </section>
      )}

      {mode === 'weighted' && (
        <>
          <p className="card-hint">
            Each attribute is rescaled to 0–1 between the values you give (worse than “worth 0” clamps to 0, better
            than “worth 1” clamps to 1 — reverse the two if less is better). Weights say how much the swing from 0 to
            1 on that attribute matters relative to the others; they are normalized to sum to 1.
          </p>
          <div className="marginal-grid">
            {project.outcomes.map((o) => {
              const m = getMarginal(o.id)
              const w = totalWeight > 0 ? Math.max(0, m.weight) / totalWeight : 0
              return (
                <section className="card marginal-card" key={o.id}>
                  <h3 className="card-title">
                    {o.name}
                    {o.unit && <span className="unit"> · {o.unit}</span>}
                  </h3>
                  <div className="marginal-fields">
                    <NumField label="value worth 0" value={m.worst} onChange={(v) => setMarginal(o.id, { worst: v })} />
                    <NumField label="value worth 1" value={m.best} onChange={(v) => setMarginal(o.id, { best: v })} />
                    <button
                      className="btn btn-small"
                      title="Set the reference points from the simulated 5–95% range across all decisions"
                      onClick={() => setMarginal(o.id, { worst: pooledRange[o.id].lo, best: pooledRange[o.id].hi })}
                    >
                      use simulated range
                    </button>
                  </div>
                  <div className="marginal-fields">
                    <label className="field">
                      <span className="field-label">
                        curvature {m.curvature === 0 ? '(linear)' : m.curvature > 0 ? '(risk-averse)' : '(risk-seeking)'}
                      </span>
                      <input
                        type="range"
                        min={-4}
                        max={4}
                        step={0.1}
                        value={m.curvature}
                        onChange={(e) => setMarginal(o.id, { curvature: Number(e.target.value) })}
                        aria-label={`Curvature for ${o.name}`}
                      />
                    </label>
                    <CurvePreview m={m} />
                  </div>
                  <div className="marginal-fields">
                    <NumField label="weight" value={m.weight} min={0} step={0.05} onChange={(v) => setMarginal(o.id, { weight: v })} />
                    <span className="chip">{(w * 100).toFixed(0)}% of total</span>
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      {mode === 'formula' && (
        <section className="card">
          <p className="card-hint">
            Write <M>U(x)</M> directly. Higher is better. Variables (click to insert):
          </p>
          <div className="var-chips">
            {project.outcomes.map((o) => (
              <button
                key={o.id}
                className="chip chip-btn"
                title={`${o.name}${o.unit ? ` (${o.unit})` : ''}`}
                onClick={() => update((p) => ({ ...p, utility: { ...p.utility, formula: (p.utility.formula + ' ' + varNames[o.id]).trimStart() } }))}
              >
                {varNames[o.id]}
              </button>
            ))}
          </div>
          <textarea
            className="formula-input"
            rows={2}
            value={project.utility.formula}
            placeholder="0.6 * total_comp / 250 + 0.4 * free_time / 40"
            onChange={(e) => update((p) => ({ ...p, utility: { ...p.utility, formula: e.target.value } }))}
            aria-label="Utility formula"
            spellCheck={false}
          />
          {compiled && !compiled.ok ? (
            <p className="dist-issue">{compiled.error}</p>
          ) : (
            <p className="card-hint">✓ formula parses{compiled && compiled.ok && compiled.expr.varsUsed.length === 0 ? ' — but uses no outcome variables, so every decision scores the same' : ''}</p>
          )}
          <p className="card-hint">
            Functions: min, max, log, log10, exp, sqrt, abs, pow, floor, ceil, round, clamp · constants pi, e ·
            operators + − × ÷ ^
          </p>
        </section>
      )}

      {mode !== 'identity' && !singleOutcome && (
        <p className="step-note">
          The trade-offs you set here are value judgments, not statistics — two people can share the same{' '}
          <M>p(x|d)</M> and still rationally choose different decisions because their <M>U(x)</M> differs.
        </p>
      )}
    </div>
  )
}

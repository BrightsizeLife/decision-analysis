import { useMemo } from 'react'
import type { DecisionModel, DistSpec, DistType, OutcomeAttr, Project } from '../types'
import { defaultDist, emptyModel } from '../types'
import { DIST_LABELS, defaultSpecFor, parseNumbers, sampleDist } from '../engine/dist'
import { RNG, hashString } from '../engine/random'
import { parseJointCsv } from '../engine/joint'
import { fmtNum, summarize } from '../engine/stats'
import { Histogram } from './charts/Histogram'
import { seriesVar } from './charts/common'
import { M, NumField, Seg } from './ui'

export function ModelStep({
  project,
  update,
}: {
  project: Project
  update: (fn: (p: Project) => Project) => void
}) {
  const setModel = (dId: string, fn: (m: DecisionModel) => DecisionModel) =>
    update((p) => ({ ...p, models: { ...p.models, [dId]: fn(p.models[dId] ?? emptyModel()) } }))

  if (project.decisions.length === 0 || project.outcomes.length === 0) {
    return (
      <div className="step">
        <header className="step-intro">
          <h2>
            Step 2 · Determine <M>p(x|d)</M>
          </h2>
          <p className="empty-hint">Add at least one decision and one outcome in step 1 first.</p>
        </header>
      </div>
    )
  }

  return (
    <div className="step">
      <header className="step-intro">
        <h2>
          Step 2 · Determine <M>p(x|d)</M> — the distribution of outcomes under each decision
        </h2>
        <p>
          For every decision, say what you believe the outcomes would be <em>if you took it</em>. All probability here
          is conditional on <M>d</M>: there is no <M>p(d)</M> and no marginal <M>p(x)</M>. Beliefs can come from
          anywhere on the spectrum — a quick prior you specify by hand, or posterior draws imported from a fitted
          model. (Doubt an option would even be implemented as planned? Fold that into its outcome distribution —{' '}
          <M>p(x|d)</M> covers imperfect implementation too.)
        </p>
        <div className="sim-settings">
          <NumField label="Simulation draws" value={project.nDraws} min={100} max={50000} step={1000} width={100} onChange={(v) => update((p) => ({ ...p, nDraws: Math.round(v) }))} />
          <NumField label="Random seed" value={project.seed} step={1} width={120} onChange={(v) => update((p) => ({ ...p, seed: Math.round(v) }))} />
          <span className="card-hint">Seeded, so results are reproducible.</span>
        </div>
      </header>

      {project.decisions.map((d) => {
        const model = project.models[d.id] ?? emptyModel()
        return (
          <section className="card decision-card" key={d.id}>
            <div className="decision-card-head">
              <span className="swatch" style={{ background: seriesVar(d.color) }} aria-hidden="true" />
              <h3 className="card-title">{d.name}</h3>
              <Seg
                value={model.mode}
                onChange={(v) => setModel(d.id, (m) => ({ ...m, mode: v }))}
                options={[
                  { value: 'independent', label: 'Specify distributions', title: 'One marginal distribution per outcome (attributes treated as independent)' },
                  { value: 'joint', label: 'Import posterior draws', title: 'Paste joint draws (e.g. from a fitted Bayesian model); preserves dependence between attributes' },
                ]}
              />
            </div>

            {model.mode === 'independent' ? (
              <div className="cell-list">
                {project.outcomes.map((o) => (
                  <DistEditor
                    key={o.id}
                    outcome={o}
                    spec={model.cells[o.id] ?? defaultDist()}
                    seedKey={`${project.seed}:${d.id}:${o.id}`}
                    color={seriesVar(d.color)}
                    onChange={(spec) => setModel(d.id, (m) => ({ ...m, cells: { ...m.cells, [o.id]: spec } }))}
                  />
                ))}
                {project.outcomes.length > 1 && (
                  <p className="card-hint">
                    Attributes specified this way are sampled independently. If they move together (say, salary and
                    hours), import joint draws instead.
                  </p>
                )}
              </div>
            ) : (
              <JointEditor
                model={model}
                outcomes={project.outcomes}
                color={seriesVar(d.color)}
                onChange={(csv) => setModel(d.id, (m) => ({ ...m, jointCsv: csv }))}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}

// --- Marginal distribution editor -------------------------------------------

function DistEditor({
  outcome,
  spec,
  onChange,
  seedKey,
  color,
}: {
  outcome: OutcomeAttr
  spec: DistSpec
  onChange: (s: DistSpec) => void
  seedKey: string
  color: string
}) {
  const preview = useMemo(() => sampleDist(spec, new RNG(hashString(seedKey)), 1200), [spec, seedKey])
  const s = useMemo(() => summarize(preview.draws), [preview])
  const isDefault = spec.type === 'point' && spec.value === 0

  return (
    <div className="dist-row">
      <div className="dist-meta">
        <div className="dist-outcome">
          {outcome.name}
          {outcome.unit && <span className="unit"> · {outcome.unit}</span>}
        </div>
        <select
          value={spec.type}
          aria-label={`Distribution type for ${outcome.name}`}
          onChange={(e) => onChange(defaultSpecFor(e.target.value as DistType, spec))}
        >
          {(Object.keys(DIST_LABELS) as DistType[]).map((t) => (
            <option key={t} value={t}>
              {DIST_LABELS[t]}
            </option>
          ))}
        </select>
        {isDefault && <span className="chip chip-warn" title="Still the default point mass at 0 — edit it to reflect your beliefs.">default</span>}
      </div>

      <div className="dist-params">
        <DistParams spec={spec} onChange={onChange} />
      </div>

      <div className="dist-preview">
        <Histogram values={preview.draws} color={color} height={92} unit={outcome.unit} bins={20} />
        <div className="dist-summary">
          median {fmtNum(s.q50)} · 90% in [{fmtNum(s.q05)}, {fmtNum(s.q95)}]
        </div>
        {preview.issues.length > 0 && <div className="dist-issue">{preview.issues[0]}</div>}
      </div>
    </div>
  )
}

function DistParams({ spec, onChange }: { spec: DistSpec; onChange: (s: DistSpec) => void }) {
  switch (spec.type) {
    case 'point':
      return <NumField label="value" value={spec.value} onChange={(v) => onChange({ ...spec, value: v })} />
    case 'normal':
      return (
        <>
          <NumField label="mean" value={spec.mean} onChange={(v) => onChange({ ...spec, mean: v })} />
          <NumField label="sd" value={spec.sd} min={0} onChange={(v) => onChange({ ...spec, sd: v })} />
        </>
      )
    case 'lognormal':
      return (
        <>
          <NumField label="median" value={spec.median} onChange={(v) => onChange({ ...spec, median: v })} />
          <NumField label="σ (log scale)" value={spec.sigma} min={0} step={0.05} onChange={(v) => onChange({ ...spec, sigma: v })} />
        </>
      )
    case 'uniform':
      return (
        <>
          <NumField label="min" value={spec.min} onChange={(v) => onChange({ ...spec, min: v })} />
          <NumField label="max" value={spec.max} onChange={(v) => onChange({ ...spec, max: v })} />
        </>
      )
    case 'beta':
      return (
        <>
          <NumField label="α" value={spec.alpha} min={0.01} step={0.1} width={70} onChange={(v) => onChange({ ...spec, alpha: v })} />
          <NumField label="β" value={spec.beta} min={0.01} step={0.1} width={70} onChange={(v) => onChange({ ...spec, beta: v })} />
          <NumField label="min" value={spec.min} width={70} onChange={(v) => onChange({ ...spec, min: v })} />
          <NumField label="max" value={spec.max} width={70} onChange={(v) => onChange({ ...spec, max: v })} />
        </>
      )
    case 'discrete':
      return (
        <div className="discrete-rows">
          {spec.rows.map((r, i) => (
            <div className="discrete-row" key={i}>
              <NumField label={i === 0 ? 'value' : undefined} value={r.value} width={80} onChange={(v) => onChange({ ...spec, rows: spec.rows.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
              <NumField label={i === 0 ? 'prob' : undefined} value={r.prob} min={0} step={0.05} width={70} onChange={(v) => onChange({ ...spec, rows: spec.rows.map((x, j) => (j === i ? { ...x, prob: v } : x)) })} />
              <button
                className="btn-icon"
                title="Remove row"
                disabled={spec.rows.length <= 1}
                onClick={() => onChange({ ...spec, rows: spec.rows.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </div>
          ))}
          <button className="btn btn-small" onClick={() => onChange({ ...spec, rows: [...spec.rows, { value: 0, prob: 0.1 }] })}>
            + row
          </button>
          <ProbSum rows={spec.rows} />
        </div>
      )
    case 'samples': {
      const k = parseNumbers(spec.raw).length
      return (
        <div className="samples-box">
          <textarea
            value={spec.raw}
            rows={3}
            placeholder={'Paste draws for this one attribute:\n12.1, 13.4, 9.8, …'}
            onChange={(e) => onChange({ ...spec, raw: e.target.value })}
            aria-label="Pasted posterior draws"
          />
          <span className="card-hint">{k.toLocaleString('en-US')} draws parsed · resampled with replacement</span>
        </div>
      )
    }
  }
}

function ProbSum({ rows }: { rows: { prob: number }[] }) {
  const total = rows.reduce((s, r) => s + Math.max(0, r.prob), 0)
  const off = Math.abs(total - 1) > 1e-6
  return (
    <span className={off ? 'chip chip-warn' : 'chip'} title={off ? 'Probabilities are normalized to sum to 1 at simulation time.' : undefined}>
      Σp = {total.toPrecision(3)}
      {off ? ' → normalized' : ''}
    </span>
  )
}

// --- Joint posterior-draw import ---------------------------------------------

function JointEditor({
  model,
  outcomes,
  color,
  onChange,
}: {
  model: DecisionModel
  outcomes: OutcomeAttr[]
  color: string
  onChange: (csv: string) => void
}) {
  const parsed = useMemo(() => parseJointCsv(model.jointCsv, outcomes), [model.jointCsv, outcomes])
  return (
    <div className="joint-editor">
      <p className="card-hint">
        Paste draws from a fitted model (e.g. a Stan/PyMC posterior): one row per draw, one column per outcome.
        Headers are matched to outcome names; without headers, columns follow the outcome order. Rows are resampled
        jointly, so correlation between attributes is preserved.
      </p>
      <textarea
        className="joint-textarea"
        rows={7}
        value={model.jointCsv}
        placeholder={`${outcomes.map((o) => o.name).join(', ')}\n165, 24, 7.1\n212, 18, 5.4\n…`}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pasted joint posterior draws (CSV)"
      />
      {parsed.ok ? (
        <>
          <p className="card-hint">
            {parsed.nRows.toLocaleString('en-US')} joint draws parsed
            {parsed.skippedRows > 0 ? ` · ${parsed.skippedRows} rows skipped` : ''}
            {parsed.extraHeaders.length > 0 ? ` · unmatched columns: ${parsed.extraHeaders.join(', ')}` : ''}
          </p>
          <div className="joint-previews">
            {outcomes.map((o) =>
              o.id in parsed.cols ? (
                <div key={o.id} className="joint-preview">
                  <div className="dist-outcome">
                    {o.name}
                    {o.unit && <span className="unit"> · {o.unit}</span>}
                  </div>
                  <Histogram values={parsed.cols[o.id]} color={color} height={92} unit={o.unit} bins={20} />
                </div>
              ) : (
                <div key={o.id} className="joint-preview">
                  <div className="dist-outcome">{o.name}</div>
                  <p className="dist-issue">No matching column — falls back to its specified distribution.</p>
                </div>
              ),
            )}
          </div>
        </>
      ) : (
        model.jointCsv.trim() !== '' && <p className="dist-issue">{parsed.error}</p>
      )}
    </div>
  )
}

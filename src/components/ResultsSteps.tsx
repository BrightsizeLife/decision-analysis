// Step 4 (full journey): compute E[U(x)|d] and rank decisions.
// "Compare" (quick journey): stop after step 2 and compare p(x|d) directly.

import { useMemo } from 'react'
import type { Project } from '../types'
import { simulate } from '../engine/simulate'
import { fmtNum, fmtPct, summarize, type Summary } from '../engine/stats'
import { Histogram } from './charts/Histogram'
import { IntervalPlot } from './charts/IntervalPlot'
import { RankBars } from './charts/RankBars'
import { seriesVar } from './charts/common'
import { M, WarnList } from './ui'

export function DecideStep({ project }: { project: Project }) {
  const sim = useMemo(() => simulate(project, true), [project])
  const n = project.nDraws

  const ranked = useMemo(() => {
    const rows = project.decisions
      .map((d) => {
        const u = sim.byDecision[d.id]?.utility
        if (!u) return null
        const s = summarize(u)
        return { d, s, se: s.sd / Math.sqrt(s.n) }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    rows.sort((a, b) => b.s.mean - a.s.mean)
    return rows
  }, [project.decisions, sim])

  if (project.decisions.length === 0 || project.outcomes.length === 0) {
    return (
      <div className="step">
        <header className="step-intro">
          <h2>
            Step 4 · Maximize <M>E[U(x)&thinsp;|&thinsp;d]</M>
          </h2>
          <p className="empty-hint">Complete steps 1–3 first.</p>
        </header>
      </div>
    )
  }

  const allIssues = [...sim.issues, ...project.decisions.flatMap((d) => (sim.byDecision[d.id]?.issues ?? []).map((s) => `${d.name}: ${s}`))]

  if (ranked.length === 0) {
    return (
      <div className="step">
        <header className="step-intro">
          <h2>
            Step 4 · Maximize <M>E[U(x)&thinsp;|&thinsp;d]</M>
          </h2>
        </header>
        <WarnList issues={allIssues.length ? allIssues : ['Utility could not be computed — check step 3.']} />
      </div>
    )
  }

  const best = ranked[0]
  const runnerUp = ranked[1]
  const margin = runnerUp ? best.s.mean - runnerUp.s.mean : Infinity
  const combinedSe = runnerUp ? Math.sqrt(best.se ** 2 + runnerUp.se ** 2) : 0
  const decisive = !runnerUp || margin > 2 * combinedSe
  const pBestBest = sim.pBest?.[best.d.id]

  const uDomain: [number, number] = (() => {
    let lo = Infinity
    let hi = -Infinity
    for (const r of ranked) {
      lo = Math.min(lo, r.s.min)
      hi = Math.max(hi, r.s.max)
    }
    return lo === hi ? [lo - 0.5, hi + 0.5] : [lo, hi]
  })()

  return (
    <div className="step">
      <header className="step-intro">
        <h2>
          Step 4 · Maximize <M>E[U(x)&thinsp;|&thinsp;d]</M>
        </h2>
        <p>
          Expected utility is a function of <M>d</M> alone: the outcome uncertainty has been averaged out over{' '}
          <M>p(x|d)</M>, {n.toLocaleString('en-US')} simulated futures per decision. The recommended decision is the
          one with the highest expected utility — but check <em>how often</em> it wins, not just that it wins on
          average.
        </p>
      </header>

      <WarnList issues={allIssues} />

      <section className="card verdict-card">
        <p className="verdict">
          <span className="swatch" style={{ background: seriesVar(best.d.color) }} aria-hidden="true" />
          <strong>{best.d.name}</strong> maximizes expected utility ({fmtNum(best.s.mean)})
          {pBestBest !== undefined && <> and comes out on top in {fmtPct(pBestBest)} of simulated futures</>}.
        </p>
        {runnerUp && !decisive && (
          <p className="verdict-caveat">
            The margin over “{runnerUp.d.name}” ({fmtNum(margin)}) is within Monte Carlo noise (±{fmtNum(2 * combinedSe)}).
            Treat these as tied — or raise the number of draws in step 2 to sharpen the estimate.
          </p>
        )}
        {runnerUp && decisive && margin < 0.02 * Math.abs(best.s.mean) && (
          <p className="verdict-caveat">
            The margin is real but small — a modest change in weights or beliefs could flip the ranking. If that makes
            you uneasy, that unease is data: it means the analysis, not the arithmetic, deserves another look.
          </p>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">
          Expected utility <M>E[U(x)&thinsp;|&thinsp;d]</M>
        </h3>
        <RankBars
          items={ranked.map((r, i) => ({
            id: r.d.id,
            label: r.d.name,
            value: r.s.mean,
            se: r.se,
            color: seriesVar(r.d.color),
            best: i === 0,
            tipRows: sim.pBest ? [{ label: 'of futures, best option', value: fmtPct(sim.pBest[r.d.id] ?? 0) }] : [],
          }))}
        />
        <p className="card-hint">Whiskers show ±2 Monte Carlo standard errors of the mean.</p>
      </section>

      {sim.pBest && (
        <section className="card">
          <h3 className="card-title">How often each decision is the best one</h3>
          <RankBars
            items={ranked.map((r) => ({
              id: r.d.id,
              label: r.d.name,
              value: sim.pBest![r.d.id] ?? 0,
              color: seriesVar(r.d.color),
            }))}
            format={fmtPct}
          />
          <p className="card-hint">
            The share of simulated futures in which each decision has the highest utility. A decision can win on
            average yet lose often — that gap is the risk you are accepting.
          </p>
        </section>
      )}

      <section className="card">
        <h3 className="card-title">Distribution of utility under each decision</h3>
        <div className="multiples">
          {ranked.map((r) => (
            <figure className="multiple" key={r.d.id}>
              <figcaption>
                <span className="swatch" style={{ background: seriesVar(r.d.color) }} aria-hidden="true" /> {r.d.name}
              </figcaption>
              <Histogram values={sim.byDecision[r.d.id].utility!} color={seriesVar(r.d.color)} height={110} domain={uDomain} />
            </figure>
          ))}
        </div>
        <SummaryTable
          title="Utility summaries"
          rows={ranked.map((r) => ({ label: r.d.name, s: r.s }))}
        />
      </section>

      <OutcomeComparison project={project} sim={sim} heading="What drives it: the outcomes under each decision" />
    </div>
  )
}

export function CompareStep({ project }: { project: Project }) {
  const sim = useMemo(() => simulate(project, false), [project])
  const allIssues = project.decisions.flatMap((d) => (sim.byDecision[d.id]?.issues ?? []).map((s) => `${d.name}: ${s}`))

  return (
    <div className="step">
      <header className="step-intro">
        <h2>
          Compare <M>p(x|d)</M> across decisions
        </h2>
        <p>
          The abbreviated journey stops here: no utility function, just the outcome distributions each decision
          implies, side by side. Often this is enough — one option dominates, or the differences are visibly smaller
          than the uncertainty. When the comparison genuinely trades off multiple attributes, switch the journey to{' '}
          <em>Full analysis</em> to add steps 3–4.
        </p>
      </header>
      <WarnList issues={allIssues} />
      <OutcomeComparison project={project} sim={sim} />
    </div>
  )
}

function OutcomeComparison({
  project,
  sim,
  heading,
}: {
  project: Project
  sim: ReturnType<typeof simulate>
  heading?: string
}) {
  return (
    <>
      {heading && <h3 className="section-title">{heading}</h3>}
      {project.outcomes.map((o) => {
        const rows = project.decisions
          .map((d) => {
            const draws = sim.byDecision[d.id]?.draws[o.id]
            if (!draws || draws.length === 0) return null
            return { id: d.id, label: d.name, color: seriesVar(d.color), s: summarize(draws) }
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
        if (rows.length === 0) return null
        return (
          <section className="card" key={o.id}>
            <h3 className="card-title">
              {o.name}
              {o.unit && <span className="unit"> · {o.unit}</span>}
              <span className={`chip kind-chip kind-${o.kind}`}>{o.kind}</span>
            </h3>
            <IntervalPlot rows={rows} unit={o.unit} />
            <p className="card-hint">Dot: median · thick band: 50% interval · thin line: 90% interval.</p>
            <SummaryTable title={`${o.name} summaries`} rows={rows.map((r) => ({ label: r.label, s: r.s }))} />
          </section>
        )
      })}
    </>
  )
}

function SummaryTable({ title, rows }: { title: string; rows: { label: string; s: Summary }[] }) {
  return (
    <details className="table-details">
      <summary>View as table</summary>
      <div className="table-scroll">
        <table>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Decision</th>
              <th scope="col">Mean</th>
              <th scope="col">SD</th>
              <th scope="col">5%</th>
              <th scope="col">25%</th>
              <th scope="col">Median</th>
              <th scope="col">75%</th>
              <th scope="col">95%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{fmtNum(r.s.mean)}</td>
                <td>{fmtNum(r.s.sd)}</td>
                <td>{fmtNum(r.s.q05)}</td>
                <td>{fmtNum(r.s.q25)}</td>
                <td>{fmtNum(r.s.q50)}</td>
                <td>{fmtNum(r.s.q75)}</td>
                <td>{fmtNum(r.s.q95)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

import type { Mode, Project } from '../types'
import { newProject } from '../types'
import { EXAMPLES } from '../examples'
import { M } from './ui'

const JOURNEYS: { mode: Mode; title: string; steps: string[]; blurb: string }[] = [
  {
    mode: 'full',
    title: 'Full analysis',
    steps: ['1 · Specify d and x', '2 · Model p(x|d)', '3 · Define U(x)', '4 · Maximize E[U(x)|d]'],
    blurb: 'All four steps. Trade off multiple outcome attributes with an explicit utility function, then pick the decision with the highest expected utility.',
  },
  {
    mode: 'quick',
    title: 'Quick compare',
    steps: ['1 · Specify d and x', '2 · Model p(x|d)', '→ Compare distributions'],
    blurb: 'The abbreviated version: stop after step 2 and compare the outcome distributions under each decision directly — no utility function needed.',
  },
  {
    mode: 'tree',
    title: 'Sequential decisions',
    steps: ['Build a decision tree', '→ Roll back expected utility'],
    blurb: 'Two or more decisions in sequence. Expected utility is computed at each decision point, conditional on everything known by then.',
  },
]

export function Home({
  onCreate,
  onImport,
}: {
  onCreate: (p: Project) => void
  onImport: () => void
}) {
  return (
    <div className="home">
      <section className="hero">
        <p className="hero-eyebrow">Bayesian decision analysis · after Gelman et&nbsp;al., BDA ch.&nbsp;9</p>
        <h1>
          <M>d</M> <span className="hero-arrow">→</span> <M>x</M> <span className="hero-arrow">→</span> <M>U(x)</M>
        </h1>
        <p className="hero-sub">
          Enumerate your possible decisions <M>d</M> and outcomes <M>x</M>. Say what you believe about{' '}
          <M>p(x|d)</M> — every probability is conditional on a decision; there is no <M>p(d)</M>. Give outcomes a
          relative value <M>U(x)</M>. Then let the machinery find the <M>d</M> that maximizes{' '}
          <M>E[U(x)&thinsp;|&thinsp;d]</M>.
        </p>
      </section>

      <section>
        <h2 className="section-title">Choose your journey</h2>
        <div className="card-row">
          {JOURNEYS.map((j) => (
            <button key={j.mode} className="journey-card" onClick={() => onCreate(newProject(j.mode, 'Untitled decision'))}>
              <h3>{j.title}</h3>
              <ol className="journey-steps">
                {j.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p>{j.blurb}</p>
              <span className="journey-cta">Start →</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Or open a worked example</h2>
        <div className="card-row">
          {EXAMPLES.map((ex) => (
            <button key={ex.key} className="example-card" onClick={() => onCreate(ex.build())}>
              <h3>{ex.title}</h3>
              <p>{ex.blurb}</p>
              <span className="journey-cta">Open →</span>
            </button>
          ))}
        </div>
        <p className="home-import">
          Have a saved analysis?{' '}
          <button className="btn-link" onClick={onImport}>
            Import a project file
          </button>
        </p>
      </section>
    </div>
  )
}

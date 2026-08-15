import type { Project } from '../types'
import { MAX_DECISIONS, uid } from '../types'
import { seriesVar } from './charts/common'
import { M, TextField } from './ui'

export function SpecifyStep({
  project,
  update,
}: {
  project: Project
  update: (fn: (p: Project) => Project) => void
}) {
  const addDecision = () =>
    update((p) => {
      const usedSlots = new Set(p.decisions.map((d) => d.color))
      let slot = 0
      while (usedSlots.has(slot) && slot < MAX_DECISIONS) slot++
      return {
        ...p,
        decisions: [...p.decisions, { id: uid(), name: `Option ${String.fromCharCode(65 + p.decisions.length)}`, notes: '', color: slot }],
      }
    })

  const addOutcome = () =>
    update((p) => ({
      ...p,
      outcomes: [...p.outcomes, { id: uid(), name: p.outcomes.length === 0 ? 'Outcome' : `Outcome ${p.outcomes.length + 1}`, unit: '', kind: 'observable', notes: '' }],
    }))

  return (
    <div className="step">
      <header className="step-intro">
        <h2>
          Step 1 · Enumerate the space of decisions <M>d</M> and outcomes <M>x</M>
        </h2>
        <p>
          This is the specification step. List every decision you could actually take, and every outcome attribute
          that matters — money, years of life, hours of free time. Outcomes form a vector{' '}
          <M>
            x = (x<sub>1</sub>, …, x<sub>k</sub>)
          </M>{' '}
          and each attribute is either an <strong>observable</strong> (a predictable quantity) or an{' '}
          <strong>unknown parameter</strong> (something never directly measured). A decision analysis is only as good
          as this enumeration: an option or outcome left off this list is invisible to every later step.
        </p>
      </header>

      <div className="two-col">
        <section className="card">
          <h3 className="card-title">
            Decisions <M>d</M>
          </h3>
          <p className="card-hint">The mutually exclusive options on the table.</p>
          {project.decisions.length === 0 && <p className="empty-hint">No decisions yet — add the options you are weighing.</p>}
          <ul className="row-list">
            {project.decisions.map((d) => (
              <li key={d.id} className="row-item">
                <span className="swatch" style={{ background: seriesVar(d.color) }} aria-hidden="true" />
                <TextField
                  value={d.name}
                  placeholder="Decision name"
                  className="grow"
                  onChange={(v) =>
                    update((p) => ({ ...p, decisions: p.decisions.map((x) => (x.id === d.id ? { ...x, name: v } : x)) }))
                  }
                />
                <TextField
                  value={d.notes}
                  placeholder="notes (optional)"
                  className="grow dim"
                  onChange={(v) =>
                    update((p) => ({ ...p, decisions: p.decisions.map((x) => (x.id === d.id ? { ...x, notes: v } : x)) }))
                  }
                />
                <button
                  className="btn-icon"
                  title="Remove decision"
                  aria-label={`Remove ${d.name}`}
                  onClick={() =>
                    update((p) => {
                      const models = { ...p.models }
                      delete models[d.id]
                      return { ...p, models, decisions: p.decisions.filter((x) => x.id !== d.id) }
                    })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={addDecision} disabled={project.decisions.length >= MAX_DECISIONS}>
            + Add decision
          </button>
          {project.decisions.length >= MAX_DECISIONS && (
            <p className="card-hint">
              Eight options is the ceiling — beyond that, comparisons stop being readable. Fold similar options together.
            </p>
          )}
        </section>

        <section className="card">
          <h3 className="card-title">
            Outcome attributes <M>x</M>
          </h3>
          <p className="card-hint">What each decision leads to. One attribute is fine; several make the trade-offs explicit.</p>
          {project.outcomes.length === 0 && <p className="empty-hint">No outcomes yet — add what you care about (money, years of life…).</p>}
          <ul className="row-list">
            {project.outcomes.map((o) => (
              <li key={o.id} className="row-item">
                <TextField
                  value={o.name}
                  placeholder="Outcome name"
                  className="grow"
                  onChange={(v) =>
                    update((p) => ({ ...p, outcomes: p.outcomes.map((x) => (x.id === o.id ? { ...x, name: v } : x)) }))
                  }
                />
                <TextField
                  value={o.unit}
                  placeholder="unit"
                  width={84}
                  onChange={(v) =>
                    update((p) => ({ ...p, outcomes: p.outcomes.map((x) => (x.id === o.id ? { ...x, unit: v } : x)) }))
                  }
                />
                <select
                  value={o.kind}
                  aria-label="Outcome kind"
                  title="Observable: a quantity you could eventually measure. Parameter: an unknown you never observe directly."
                  onChange={(e) =>
                    update((p) => ({
                      ...p,
                      outcomes: p.outcomes.map((x) => (x.id === o.id ? { ...x, kind: e.target.value as 'observable' | 'parameter' } : x)),
                    }))
                  }
                >
                  <option value="observable">observable</option>
                  <option value="parameter">parameter</option>
                </select>
                <button
                  className="btn-icon"
                  title="Remove outcome"
                  aria-label={`Remove ${o.name}`}
                  onClick={() =>
                    update((p) => {
                      const models = Object.fromEntries(
                        Object.entries(p.models).map(([did, m]) => {
                          const cells = { ...m.cells }
                          delete cells[o.id]
                          return [did, { ...m, cells }]
                        }),
                      )
                      const weighted = { ...p.utility.weighted }
                      delete weighted[o.id]
                      return {
                        ...p,
                        models,
                        outcomes: p.outcomes.filter((x) => x.id !== o.id),
                        utility: {
                          ...p.utility,
                          weighted,
                          identityOutcomeId: p.utility.identityOutcomeId === o.id ? null : p.utility.identityOutcomeId,
                        },
                      }
                    })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="btn" onClick={addOutcome}>
            + Add outcome
          </button>
        </section>
      </div>
    </div>
  )
}

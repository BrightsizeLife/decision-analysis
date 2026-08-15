import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mode, Project } from './types'
import { emptyModel, emptyTree, emptyUtility } from './types'
import { Home } from './components/Home'
import { SpecifyStep } from './components/SpecifyStep'
import { ModelStep } from './components/ModelStep'
import { UtilityStep } from './components/UtilityStep'
import { CompareStep, DecideStep } from './components/ResultsSteps'
import { TreeStep } from './components/TreeStep'
import { M, Seg, TextField } from './components/ui'

const STORAGE_KEY = 'dw:project'
const STEP_KEY = 'dw:step'
const THEME_KEY = 'dw:theme'

type Theme = 'auto' | 'light' | 'dark'

interface StepDef {
  key: string
  short: string
  math: string
  render: (project: Project, update: (fn: (p: Project) => Project) => void) => JSX.Element
}

const STEPS: Record<Mode, StepDef[]> = {
  full: [
    { key: 'specify', short: 'Specify', math: 'd, x', render: (p, u) => <SpecifyStep project={p} update={u} /> },
    { key: 'model', short: 'Model', math: 'p(x|d)', render: (p, u) => <ModelStep project={p} update={u} /> },
    { key: 'utility', short: 'Utility', math: 'U(x)', render: (p, u) => <UtilityStep project={p} update={u} /> },
    { key: 'decide', short: 'Decide', math: 'E[U|d]', render: (p) => <DecideStep project={p} /> },
  ],
  quick: [
    { key: 'specify', short: 'Specify', math: 'd, x', render: (p, u) => <SpecifyStep project={p} update={u} /> },
    { key: 'model', short: 'Model', math: 'p(x|d)', render: (p, u) => <ModelStep project={p} update={u} /> },
    { key: 'compare', short: 'Compare', math: 'p(x|d) by d', render: (p) => <CompareStep project={p} /> },
  ],
  tree: [{ key: 'tree', short: 'Tree', math: 'max, E, max…', render: (p, u) => <TreeStep project={p} update={u} /> }],
}

function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return reviveProject(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Fill in any missing fields so older/partial saves still load. */
function reviveProject(p: unknown): Project | null {
  if (!p || typeof p !== 'object') return null
  const o = p as Partial<Project>
  if (!Array.isArray(o.decisions) || !Array.isArray(o.outcomes)) return null
  const mode: Mode = o.mode === 'quick' || o.mode === 'tree' ? o.mode : 'full'
  return {
    id: typeof o.id === 'string' ? o.id : 'imported',
    name: typeof o.name === 'string' ? o.name : 'Imported decision',
    mode,
    seed: Number.isFinite(o.seed) ? (o.seed as number) : 20260815,
    nDraws: Number.isFinite(o.nDraws) ? (o.nDraws as number) : 4000,
    decisions: o.decisions.map((d, i) => ({
      id: String(d?.id ?? `d${i}`),
      name: String(d?.name ?? `Option ${i + 1}`),
      notes: String(d?.notes ?? ''),
      color: Number.isFinite(d?.color) ? (d.color as number) : i,
    })),
    outcomes: o.outcomes.map((x, i) => ({
      id: String(x?.id ?? `o${i}`),
      name: String(x?.name ?? `Outcome ${i + 1}`),
      unit: String(x?.unit ?? ''),
      kind: x?.kind === 'parameter' ? 'parameter' : 'observable',
      notes: String(x?.notes ?? ''),
    })),
    models: typeof o.models === 'object' && o.models ? (o.models as Project['models']) : {},
    utility: o.utility && typeof o.utility === 'object' ? { ...emptyUtility(), ...(o.utility as Project['utility']) } : emptyUtility(),
    tree: o.tree && typeof o.tree === 'object' ? (o.tree as Project['tree']) : emptyTree(),
  }
}

export default function App() {
  const [project, setProject] = useState<Project | null>(() => loadProject())
  const [step, setStep] = useState<number>(() => {
    const v = Number(localStorage.getItem(STEP_KEY))
    return Number.isFinite(v) ? v : 0
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      if (project) localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage may be unavailable (private mode, sandbox) — the app still works.
    }
  }, [project])

  useEffect(() => {
    try {
      localStorage.setItem(STEP_KEY, String(step))
    } catch {}
  }, [step])

  useEffect(() => {
    const rootEl = document.documentElement
    if (theme === 'auto') rootEl.removeAttribute('data-theme')
    else rootEl.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {}
  }, [theme])

  const update = (fn: (p: Project) => Project) => setProject((p) => (p ? fn(p) : p))

  const steps = useMemo(() => (project ? STEPS[project.mode] : []), [project])
  const stepIdx = Math.min(step, Math.max(0, steps.length - 1))

  const startProject = (p: Project) => {
    // Make sure every decision has a model shell so step 2 renders cleanly.
    const models = { ...p.models }
    for (const d of p.decisions) if (!models[d.id]) models[d.id] = emptyModel()
    setProject({ ...p, models })
    setStep(0)
    window.scrollTo(0, 0)
  }

  const exportProject = async () => {
    if (!project) return
    const json = JSON.stringify(project, null, 2)
    const filename = `${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'decision'}.json`
    // Sandboxed hosts (like the claude.ai artifact viewer) block anchor
    // downloads but mediate saves through a runtime API instead.
    const rt = (
      window as {
        claude?: { use?: (n: string) => Promise<{ save: (r: { filename: string; data: string }) => Promise<unknown> } | null> }
      }
    ).claude
    if (rt?.use) {
      try {
        const downloads = await rt.use('downloads')
        if (downloads) {
          await downloads.save({ filename, data: json })
          return
        }
      } catch {
        return // viewer declined or the save prompt failed — don't also fire a blocked anchor
      }
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const importProject = () => fileRef.current?.click()

  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const revived = reviveProject(JSON.parse(String(reader.result)))
        if (revived) startProject(revived)
        else window.alert('That file doesn’t look like a saved decision project.')
      } catch {
        window.alert('Could not parse that file as JSON.')
      }
    }
    reader.readAsText(f)
  }

  const themeNext: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }
  const themeIcon: Record<Theme, string> = { auto: '◐ auto', light: '○ light', dark: '● dark' }

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          title="Back to the start screen (your project is saved locally)"
          onClick={() => {
            setStep(0)
            setProject(null)
          }}
        >
          <span className="brand-name">Decision Workbench</span>
          <span className="brand-pipe">
            <M>d</M> → <M>x</M> → <M>U(x)</M>
          </span>
        </button>
        <div className="topbar-actions">
          {project && (
            <>
              <TextField
                value={project.name}
                placeholder="Untitled decision"
                className="project-name"
                onChange={(v) => update((p) => ({ ...p, name: v }))}
              />
              <Seg<Mode>
                value={project.mode}
                onChange={(m) => {
                  update((p) => ({ ...p, mode: m }))
                  setStep(Math.min(stepIdx, STEPS[m].length - 1))
                }}
                options={[
                  { value: 'full', label: 'Full', title: 'All four steps' },
                  { value: 'quick', label: 'Quick', title: 'Steps 1–2, then compare distributions' },
                  { value: 'tree', label: 'Tree', title: 'Sequential decisions' },
                ]}
              />
              <button className="btn btn-small" onClick={exportProject} title="Download this project as JSON">
                Export
              </button>
            </>
          )}
          <button className="btn btn-small" onClick={importProject} title="Import a project JSON file">
            Import
          </button>
          <button className="btn btn-small" onClick={() => setTheme(themeNext[theme])} title="Cycle theme: auto → light → dark">
            {themeIcon[theme]}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={onFile} aria-label="Import project file" />
      </header>

      {!project ? (
        <Home onCreate={startProject} onImport={importProject} />
      ) : (
        <main className="main">
          {steps.length > 1 && (
            <nav className="stepper" aria-label="Analysis steps">
              {steps.map((s, i) => (
                <button
                  key={s.key}
                  className={i === stepIdx ? 'stepper-btn stepper-on' : 'stepper-btn'}
                  aria-current={i === stepIdx ? 'step' : undefined}
                  onClick={() => {
                    setStep(i)
                    window.scrollTo(0, 0)
                  }}
                >
                  <span className="stepper-num">{i + 1}</span>
                  <span className="stepper-text">
                    {s.short} <span className="math stepper-math">{s.math}</span>
                  </span>
                </button>
              ))}
            </nav>
          )}

          {steps[stepIdx]?.render(project, update)}

          {steps.length > 1 && (
            <div className="step-footer">
              <button className="btn" disabled={stepIdx === 0} onClick={() => { setStep(stepIdx - 1); window.scrollTo(0, 0) }}>
                ← {steps[stepIdx - 1]?.short ?? ''}
              </button>
              <button className="btn btn-primary" disabled={stepIdx >= steps.length - 1} onClick={() => { setStep(stepIdx + 1); window.scrollTo(0, 0) }}>
                {steps[stepIdx + 1]?.short ?? ''} →
              </button>
            </div>
          )}
        </main>
      )}

      <footer className="footer">
        After Gelman, Carlin, Stern, Dunson, Vehtari &amp; Rubin, <em>Bayesian Data Analysis</em> (3rd ed.), ch. 9.
        Everything runs in your browser; projects live in local storage until you export them.
      </footer>
    </div>
  )
}

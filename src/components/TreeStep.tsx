// Sequential decisions: an editable tree with live backward induction.
// Decision nodes take the max over options; chance nodes take the
// probability-weighted average — expected utility at each decision point,
// conditional on all information available up to that point.

import { useMemo } from 'react'
import type { Project, TreeNode } from '../types'
import { uid } from '../types'
import { convertNode, newTerminal, rollback, treeDepth, updateNode, type Rollback } from '../engine/tree'
import { fmtNum } from '../engine/stats'
import { M, NumField, TextField, WarnList } from './ui'

export function TreeStep({
  project,
  update,
}: {
  project: Project
  update: (fn: (p: Project) => Project) => void
}) {
  const rb = useMemo(() => rollback(project.tree), [project.tree])
  const setTree = (fn: (t: TreeNode) => TreeNode) => update((p) => ({ ...p, tree: fn(p.tree) }))

  return (
    <div className="step">
      <header className="step-intro">
        <h2>Sequential decisions · roll back the tree</h2>
        <p>
          When two or more decisions happen in sequence, expected utility must be computed at <em>each</em> decision
          point, conditional on all information available up to that point. Build the tree below; values roll back
          automatically — chance nodes average over their branches, decision nodes take the best option. The
          highlighted path is the optimal strategy <em>today</em>: later choices are answered in advance for every way
          the world could turn.
        </p>
        <p className="card-hint">
          ■ decision (you choose) · ● chance (the world chooses, with probabilities) · ◆ terminal (a final utility —
          run a four-step analysis first if you need help valuing an endpoint). Tree depth: {treeDepth(project.tree)}.
        </p>
      </header>

      <WarnList issues={rb.issues} />

      <section className="card tree-card">
        <NodeEditor node={project.tree} rb={rb} setTree={setTree} isRoot onBest />
      </section>
    </div>
  )
}

function NodeEditor({
  node,
  rb,
  setTree,
  isRoot = false,
  onBest,
}: {
  node: TreeNode
  rb: Rollback
  setTree: (fn: (t: TreeNode) => TreeNode) => void
  isRoot?: boolean
  /** True when this node sits on the optimal (rolled-back) path. */
  onBest: boolean
}) {
  const patch = (fn: (n: TreeNode) => TreeNode) =>
    setTree((t) => updateNode(t, node.id, fn))

  const kindSymbol = node.kind === 'decision' ? '■' : node.kind === 'chance' ? '●' : '◆'
  const value = rb.value[node.id]

  return (
    <div className={onBest ? 'tree-node tree-node-best' : 'tree-node'}>
      <div className="tree-node-head">
        <span className={`tree-kind tree-kind-${node.kind}`} aria-hidden="true">
          {kindSymbol}
        </span>
        <select
          value={node.kind}
          aria-label="Node kind"
          onChange={(e) => patch((n) => convertNode(n, e.target.value as TreeNode['kind']))}
        >
          <option value="decision">decision</option>
          <option value="chance">chance</option>
          <option value="terminal">terminal</option>
        </select>
        <TextField
          value={node.label}
          placeholder={node.kind === 'terminal' ? 'endpoint label' : 'node label'}
          className="grow"
          onChange={(v) => patch((n) => ({ ...n, label: v }))}
        />
        {node.kind === 'terminal' ? (
          <NumField label="utility" value={node.value} onChange={(v) => patch((n) => (n.kind === 'terminal' ? { ...n, value: v } : n))} />
        ) : (
          <span className="tree-value" title={node.kind === 'decision' ? 'Value of the best option from here' : 'Probability-weighted average from here'}>
            <M>E[U]</M> = <strong>{fmtNum(value ?? 0)}</strong>
          </span>
        )}
      </div>

      {node.kind === 'decision' && (
        <ul className="tree-children">
          {node.options.map((o) => {
            const isBest = rb.best[node.id] === o.id
            return (
              <li key={o.id} className={isBest ? 'tree-edge tree-edge-best' : 'tree-edge'}>
                <div className="tree-edge-head">
                  <TextField
                    value={o.label}
                    placeholder="option"
                    className="edge-label"
                    onChange={(v) =>
                      patch((n) => (n.kind === 'decision' ? { ...n, options: n.options.map((x) => (x.id === o.id ? { ...x, label: v } : x)) } : n))
                    }
                  />
                  {isBest && node.options.length > 1 && <span className="chip chip-best">← choose this</span>}
                  <button
                    className="btn-icon"
                    title="Remove option"
                    onClick={() => patch((n) => (n.kind === 'decision' ? { ...n, options: n.options.filter((x) => x.id !== o.id) } : n))}
                  >
                    ×
                  </button>
                </div>
                <NodeEditor node={o.child} rb={rb} setTree={setTree} onBest={onBest && isBest} />
              </li>
            )
          })}
          <li>
            <button
              className="btn btn-small"
              onClick={() =>
                patch((n) => (n.kind === 'decision' ? { ...n, options: [...n.options, { id: uid(), label: `Option ${String.fromCharCode(65 + n.options.length)}`, child: newTerminal('') }] } : n))
              }
            >
              + option
            </button>
          </li>
        </ul>
      )}

      {node.kind === 'chance' && (
        <ul className="tree-children">
          {node.branches.map((b) => {
            return (
              <li key={b.id} className="tree-edge">
                <div className="tree-edge-head">
                  <TextField
                    value={b.label}
                    placeholder="outcome"
                    className="edge-label"
                    onChange={(v) =>
                      patch((n) => (n.kind === 'chance' ? { ...n, branches: n.branches.map((x) => (x.id === b.id ? { ...x, label: v } : x)) } : n))
                    }
                  />
                  <NumField
                    label="p"
                    value={b.prob}
                    min={0}
                    max={1}
                    step={0.05}
                    width={70}
                    onChange={(v) =>
                      patch((n) => (n.kind === 'chance' ? { ...n, branches: n.branches.map((x) => (x.id === b.id ? { ...x, prob: v } : x)) } : n))
                    }
                  />
                  <button
                    className="btn-icon"
                    title="Remove branch"
                    onClick={() => patch((n) => (n.kind === 'chance' ? { ...n, branches: n.branches.filter((x) => x.id !== b.id) } : n))}
                  >
                    ×
                  </button>
                </div>
                <NodeEditor node={b.child} rb={rb} setTree={setTree} onBest={onBest} />
              </li>
            )
          })}
          <li className="tree-edge-footer">
            <button
              className="btn btn-small"
              onClick={() =>
                patch((n) => (n.kind === 'chance' ? { ...n, branches: [...n.branches, { id: uid(), label: 'Outcome', prob: 0.1, child: newTerminal('') }] } : n))
              }
            >
              + branch
            </button>
            <ProbNote node={node} />
          </li>
        </ul>
      )}

      {isRoot && node.kind === 'terminal' && (
        <p className="card-hint">A one-node tree isn’t much of a sequence — switch the root to a decision node.</p>
      )}
    </div>
  )
}

function ProbNote({ node }: { node: Extract<TreeNode, { kind: 'chance' }> }) {
  const total = node.branches.reduce((s, b) => s + Math.max(0, b.prob), 0)
  const off = Math.abs(total - 1) > 1e-6
  return (
    <span className={off ? 'chip chip-warn' : 'chip'}>
      Σp = {total.toPrecision(3)}
      {off ? ' → normalized' : ''}
    </span>
  )
}

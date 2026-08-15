// Sequential decisions: backward induction ("rollback") over a decision tree.
// At a chance node the value is the probability-weighted average of its
// branches; at a decision node it is the maximum over its options — i.e.
// expected utility computed at each decision point, conditional on
// everything known at that point (BDA ch. 9).

import type { TreeBranch, TreeNode, TreeOption } from '../types'
import { uid } from '../types'

export interface Rollback {
  /** Rolled-back expected value for every node id. */
  value: Record<string, number>
  /** For each decision node id, the option id with the highest value. */
  best: Record<string, string>
  issues: string[]
}

export function rollback(root: TreeNode): Rollback {
  const value: Record<string, number> = {}
  const best: Record<string, string> = {}
  const issues: string[] = []

  function visit(node: TreeNode, path: string): number {
    switch (node.kind) {
      case 'terminal': {
        const v = Number.isFinite(node.value) ? node.value : 0
        value[node.id] = v
        return v
      }
      case 'chance': {
        if (node.branches.length === 0) {
          issues.push(`Chance node “${node.label || path}” has no branches; its value is 0.`)
          value[node.id] = 0
          return 0
        }
        const total = node.branches.reduce((s, b) => s + Math.max(0, b.prob), 0)
        if (total <= 0) {
          issues.push(`Chance node “${node.label || path}” has no positive probabilities; its value is 0.`)
          value[node.id] = 0
          return 0
        }
        if (Math.abs(total - 1) > 1e-6) {
          issues.push(`Probabilities at “${node.label || path}” sum to ${total.toPrecision(3)}; normalized to 1.`)
        }
        let v = 0
        for (const b of node.branches) {
          const child = visit(b.child, `${path} → ${b.label}`)
          v += (Math.max(0, b.prob) / total) * child
        }
        value[node.id] = v
        return v
      }
      case 'decision': {
        if (node.options.length === 0) {
          issues.push(`Decision node “${node.label || path}” has no options; its value is 0.`)
          value[node.id] = 0
          return 0
        }
        let bestV = -Infinity
        let bestId = node.options[0].id
        for (const o of node.options) {
          const v = visit(o.child, `${path} → ${o.label}`)
          if (v > bestV) {
            bestV = v
            bestId = o.id
          }
        }
        value[node.id] = bestV
        best[node.id] = bestId
        return bestV
      }
    }
  }

  visit(root, 'root')
  return { value, best, issues }
}

// --- Immutable tree editing helpers ----------------------------------------

export function newTerminal(label = 'Outcome'): TreeNode {
  return { kind: 'terminal', id: uid(), label, value: 0 }
}

export function newChance(label = 'Chance'): TreeNode {
  return {
    kind: 'chance',
    id: uid(),
    label,
    branches: [
      { id: uid(), label: 'Outcome A', prob: 0.5, child: newTerminal('') },
      { id: uid(), label: 'Outcome B', prob: 0.5, child: newTerminal('') },
    ],
  }
}

export function newDecision(label = 'Decision'): TreeNode {
  return {
    kind: 'decision',
    id: uid(),
    label,
    options: [
      { id: uid(), label: 'Option A', child: newTerminal('') },
      { id: uid(), label: 'Option B', child: newTerminal('') },
    ],
  }
}

/** Return a new tree with `fn` applied to the node with the given id. */
export function updateNode(root: TreeNode, id: string, fn: (n: TreeNode) => TreeNode): TreeNode {
  if (root.id === id) return fn(root)
  switch (root.kind) {
    case 'terminal':
      return root
    case 'chance':
      return {
        ...root,
        branches: root.branches.map((b): TreeBranch => ({ ...b, child: updateNode(b.child, id, fn) })),
      }
    case 'decision':
      return {
        ...root,
        options: root.options.map((o): TreeOption => ({ ...o, child: updateNode(o.child, id, fn) })),
      }
  }
}

/** Replace a node with a node of another kind, keeping its label. */
export function convertNode(node: TreeNode, kind: TreeNode['kind']): TreeNode {
  if (node.kind === kind) return node
  const label = node.label
  if (kind === 'terminal') return { ...newTerminal(label), id: node.id }
  if (kind === 'chance') return { ...(newChance(label) as Extract<TreeNode, { kind: 'chance' }>), id: node.id }
  return { ...(newDecision(label) as Extract<TreeNode, { kind: 'decision' }>), id: node.id }
}

export function countNodes(root: TreeNode): number {
  switch (root.kind) {
    case 'terminal':
      return 1
    case 'chance':
      return 1 + root.branches.reduce((s, b) => s + countNodes(b.child), 0)
    case 'decision':
      return 1 + root.options.reduce((s, o) => s + countNodes(o.child), 0)
  }
}

export function treeDepth(root: TreeNode): number {
  switch (root.kind) {
    case 'terminal':
      return 1
    case 'chance':
      return 1 + Math.max(0, ...root.branches.map((b) => treeDepth(b.child)))
    case 'decision':
      return 1 + Math.max(0, ...root.options.map((o) => treeDepth(o.child)))
  }
}

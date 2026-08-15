// Core data model, mirroring the four steps of decision analysis in
// Gelman et al., Bayesian Data Analysis, ch. 9:
//   1. Enumerate decisions d and outcomes x        -> Decision, OutcomeAttr
//   2. Determine p(x|d) for each decision          -> DecisionModel / DistSpec
//   3. Define a utility function U(x)              -> UtilitySpec
//   4. Compute E[U(x)|d] and pick the best d       -> engine/simulate.ts
// Sequential decisions (decision trees) are modeled by TreeNode.

export type Mode = 'quick' | 'full' | 'tree'

export interface Decision {
  id: string
  name: string
  notes: string
  /** Stable categorical color slot (0–7), assigned at creation so a
   *  decision keeps its color even when others are removed. */
  color: number
}

export type OutcomeKind = 'observable' | 'parameter'

export interface OutcomeAttr {
  id: string
  name: string
  unit: string
  kind: OutcomeKind
  notes: string
}

export type DistSpec =
  | { type: 'point'; value: number }
  | { type: 'normal'; mean: number; sd: number }
  | { type: 'lognormal'; median: number; sigma: number }
  | { type: 'uniform'; min: number; max: number }
  | { type: 'beta'; alpha: number; beta: number; min: number; max: number }
  | { type: 'discrete'; rows: { value: number; prob: number }[] }
  | { type: 'samples'; raw: string }

export type DistType = DistSpec['type']

export interface DecisionModel {
  /** 'independent': one marginal distribution per outcome attribute.
   *  'joint': paste posterior draws (CSV) — rows are joint draws, so
   *  dependence between attributes is preserved. */
  mode: 'independent' | 'joint'
  cells: Record<string, DistSpec> // by outcome id
  jointCsv: string
}

export interface MarginalUtil {
  /** Outcome value mapped to utility 0. May be larger than `best`
   *  (that just means lower values of x are preferred). */
  worst: number
  /** Outcome value mapped to utility 1. */
  best: number
  /** Exponential curvature r: 0 = linear; r > 0 concave (diminishing
   *  returns / risk-averse); r < 0 convex. */
  curvature: number
  /** Swing weight (relative importance of moving worst -> best). */
  weight: number
}

export type UtilityMode = 'identity' | 'weighted' | 'formula'

export interface UtilitySpec {
  mode: UtilityMode
  identityOutcomeId: string | null
  weighted: Record<string, MarginalUtil> // by outcome id
  formula: string
}

// --- Sequential decisions -------------------------------------------------

export type TreeNode =
  | { kind: 'decision'; id: string; label: string; options: TreeOption[] }
  | { kind: 'chance'; id: string; label: string; branches: TreeBranch[] }
  | { kind: 'terminal'; id: string; label: string; value: number }

export interface TreeOption {
  id: string
  label: string
  child: TreeNode
}

export interface TreeBranch {
  id: string
  label: string
  prob: number
  child: TreeNode
}

// --- Project ----------------------------------------------------------------

export interface Project {
  id: string
  name: string
  mode: Mode
  seed: number
  nDraws: number
  decisions: Decision[]
  outcomes: OutcomeAttr[]
  models: Record<string, DecisionModel> // by decision id
  utility: UtilitySpec
  tree: TreeNode
}

let uidCounter = 0
export function uid(): string {
  uidCounter += 1
  return Math.random().toString(36).slice(2, 8) + uidCounter.toString(36)
}

export const MAX_DECISIONS = 8

export function defaultDist(): DistSpec {
  return { type: 'point', value: 0 }
}

export function emptyModel(): DecisionModel {
  return { mode: 'independent', cells: {}, jointCsv: '' }
}

export function emptyTree(): TreeNode {
  return { kind: 'decision', id: uid(), label: 'Decision', options: [] }
}

export function emptyUtility(): UtilitySpec {
  return { mode: 'weighted', identityOutcomeId: null, weighted: {}, formula: '' }
}

export function newProject(mode: Mode, name: string): Project {
  return {
    id: uid(),
    name,
    mode,
    seed: 20260815,
    nDraws: 4000,
    decisions: [],
    outcomes: [],
    models: {},
    utility: emptyUtility(),
    tree: emptyTree(),
  }
}

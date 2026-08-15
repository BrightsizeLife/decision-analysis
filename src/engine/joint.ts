// Parse pasted posterior draws (CSV/TSV) for a decision. Rows are joint
// draws of the outcome vector, so dependence between attributes carries
// through to the simulation — unlike independent per-attribute marginals.

import type { OutcomeAttr } from '../types'
import { slugify } from './simulate'

export interface JointParse {
  ok: boolean
  error?: string
  /** Per-outcome column values (matched outcomes only). */
  cols: Record<string, number[]>
  nRows: number
  skippedRows: number
  /** Outcomes with no matching column (they fall back to their marginal spec). */
  unmatched: string[]
  /** Headers that matched nothing (informational). */
  extraHeaders: string[]
  hadHeader: boolean
}

export function parseJointCsv(raw: string, outcomes: OutcomeAttr[]): JointParse {
  const empty: JointParse = {
    ok: false,
    cols: {},
    nRows: 0,
    skippedRows: 0,
    unmatched: outcomes.map((o) => o.id),
    extraHeaders: [],
    hadHeader: false,
  }
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
  if (lines.length === 0) return { ...empty, error: 'Nothing pasted yet.' }

  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : lines[0].includes(',') ? ',' : /\s+/
  const split = (l: string) => l.split(delim).map((c) => c.trim()).filter((c, i, arr) => !(c === '' && i === arr.length - 1))

  const first = split(lines[0])
  const hadHeader = first.some((c) => c !== '' && !Number.isFinite(Number(c)))

  // Map each column index to an outcome id.
  const colToOutcome: (string | null)[] = []
  const extraHeaders: string[] = []
  if (hadHeader) {
    const bySlug = new Map(outcomes.map((o) => [slugify(o.name), o.id]))
    for (const h of first) {
      const id = bySlug.get(slugify(h))
      colToOutcome.push(id ?? null)
      if (!id) extraHeaders.push(h)
    }
  } else {
    // No header: columns map to outcomes in declared order.
    for (let i = 0; i < first.length; i++) {
      colToOutcome.push(i < outcomes.length ? outcomes[i].id : null)
    }
  }

  const matchedIds = colToOutcome.filter((c): c is string => c !== null)
  if (matchedIds.length === 0) {
    return {
      ...empty,
      hadHeader,
      extraHeaders,
      error: hadHeader
        ? 'No column header matches an outcome name. Headers are matched to outcomes case-insensitively.'
        : 'No numeric columns found.',
    }
  }

  const cols: Record<string, number[]> = {}
  for (const id of matchedIds) cols[id] = []
  let skippedRows = 0
  const dataLines = hadHeader ? lines.slice(1) : lines
  for (const line of dataLines) {
    const cells = split(line)
    const rowVals: Record<string, number> = {}
    let bad = false
    for (let c = 0; c < colToOutcome.length; c++) {
      const id = colToOutcome[c]
      if (!id) continue
      const v = Number(cells[c])
      if (!Number.isFinite(v)) {
        bad = true
        break
      }
      rowVals[id] = v
    }
    if (bad) {
      skippedRows++
      continue
    }
    for (const id of matchedIds) cols[id].push(rowVals[id])
  }

  const nRows = matchedIds.length ? cols[matchedIds[0]].length : 0
  if (nRows === 0) {
    return { ...empty, hadHeader, extraHeaders, error: 'No usable numeric rows found.' }
  }
  return {
    ok: true,
    cols,
    nRows,
    skippedRows,
    unmatched: outcomes.filter((o) => !(o.id in cols)).map((o) => o.id),
    extraHeaders,
    hadHeader,
  }
}

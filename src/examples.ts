// Built-in example projects, so the four steps can be explored with real
// content before building your own analysis.

import type { Project, TreeNode } from './types'
import { newProject, uid } from './types'

export interface ExampleDef {
  key: string
  title: string
  blurb: string
  build: () => Project
}

function jobOffers(): Project {
  const p = newProject('full', 'Job offer decision')
  const dStartup = { id: uid(), name: 'Join the startup', notes: 'Equity-heavy offer; comp is uncertain.', color: 0 }
  const dBigCo = { id: uid(), name: 'Join the big company', notes: 'Higher salary, less slack.', color: 1 }
  const dStay = { id: uid(), name: 'Stay in current role', notes: 'The known quantity.', color: 2 }
  const oComp = { id: uid(), name: 'Total comp', unit: '$k / yr', kind: 'observable' as const, notes: 'Salary plus expected value of equity.' }
  const oTime = { id: uid(), name: 'Free time', unit: 'hrs / wk', kind: 'observable' as const, notes: 'Evenings and weekends actually kept.' }
  const oFit = { id: uid(), name: 'Role fit', unit: '0–10', kind: 'parameter' as const, notes: 'How well the work suits you — not directly observable.' }
  p.decisions = [dStartup, dBigCo, dStay]
  p.outcomes = [oComp, oTime, oFit]
  p.models = {
    [dStartup.id]: {
      mode: 'independent',
      jointCsv: '',
      cells: {
        [oComp.id]: { type: 'lognormal', median: 165, sigma: 0.35 },
        [oTime.id]: { type: 'normal', mean: 24, sd: 6 },
        [oFit.id]: { type: 'beta', alpha: 3, beta: 1.6, min: 0, max: 10 },
      },
    },
    [dBigCo.id]: {
      mode: 'independent',
      jointCsv: '',
      cells: {
        [oComp.id]: { type: 'normal', mean: 210, sd: 15 },
        [oTime.id]: { type: 'normal', mean: 20, sd: 5 },
        [oFit.id]: { type: 'beta', alpha: 2.2, beta: 2.2, min: 0, max: 10 },
      },
    },
    [dStay.id]: {
      mode: 'independent',
      jointCsv: '',
      cells: {
        [oComp.id]: { type: 'normal', mean: 150, sd: 5 },
        [oTime.id]: { type: 'normal', mean: 30, sd: 4 },
        [oFit.id]: { type: 'beta', alpha: 2, beta: 3, min: 0, max: 10 },
      },
    },
  }
  p.utility = {
    mode: 'weighted',
    identityOutcomeId: null,
    formula: '',
    weighted: {
      [oComp.id]: { worst: 100, best: 250, curvature: 1.2, weight: 0.45 },
      [oTime.id]: { worst: 5, best: 40, curvature: 0.8, weight: 0.3 },
      [oFit.id]: { worst: 0, best: 10, curvature: 0, weight: 0.25 },
    },
  }
  return p
}

function cancerTreatment(): Project {
  const p = newProject('quick', 'Treatment choice at 95')
  const dNone = { id: uid(), name: 'No treatment', notes: '', color: 0 }
  const dRadio = { id: uid(), name: 'Radiotherapy', notes: '', color: 1 }
  const dSurgery = { id: uid(), name: 'Surgery', notes: 'Higher upside, more operative risk.', color: 2 }
  const oQale = {
    id: uid(),
    name: 'Quality-adjusted life',
    unit: 'months',
    kind: 'parameter' as const,
    notes: 'Life expectancy weighted by quality of life — an unknown parameter, not a direct observable.',
  }
  p.decisions = [dNone, dRadio, dSurgery]
  p.outcomes = [oQale]
  p.models = {
    [dNone.id]: { mode: 'independent', jointCsv: '', cells: { [oQale.id]: { type: 'normal', mean: 34.1, sd: 3.2 } } },
    [dRadio.id]: { mode: 'independent', jointCsv: '', cells: { [oQale.id]: { type: 'normal', mean: 34.8, sd: 3.6 } } },
    [dSurgery.id]: { mode: 'independent', jointCsv: '', cells: { [oQale.id]: { type: 'normal', mean: 34.6, sd: 4.8 } } },
  }
  p.utility = { mode: 'identity', identityOutcomeId: oQale.id, weighted: {}, formula: '' }
  return p
}

function pilotTree(): Project {
  const p = newProject('tree', 'Pilot study, then launch')
  const launchNow: TreeNode = {
    kind: 'chance',
    id: uid(),
    label: 'Market response',
    branches: [
      { id: uid(), label: 'Strong market', prob: 0.4, child: { kind: 'terminal', id: uid(), label: 'Launch succeeds', value: 1200 } },
      { id: uid(), label: 'Weak market', prob: 0.6, child: { kind: 'terminal', id: uid(), label: 'Launch flops', value: -400 } },
    ],
  }
  const launchAfterPositive: TreeNode = {
    kind: 'decision',
    id: uid(),
    label: 'After a positive pilot',
    options: [
      {
        id: uid(),
        label: 'Launch',
        child: {
          kind: 'chance',
          id: uid(),
          label: 'Market response',
          branches: [
            { id: uid(), label: 'Strong market', prob: 0.75, child: { kind: 'terminal', id: uid(), label: 'Succeeds (net of pilot)', value: 1120 } },
            { id: uid(), label: 'Weak market', prob: 0.25, child: { kind: 'terminal', id: uid(), label: 'Flops (net of pilot)', value: -480 } },
          ],
        },
      },
      { id: uid(), label: 'Stop', child: { kind: 'terminal', id: uid(), label: 'Walk away', value: -80 } },
    ],
  }
  const launchAfterNegative: TreeNode = {
    kind: 'decision',
    id: uid(),
    label: 'After a negative pilot',
    options: [
      {
        id: uid(),
        label: 'Launch anyway',
        child: {
          kind: 'chance',
          id: uid(),
          label: 'Market response',
          branches: [
            { id: uid(), label: 'Strong market', prob: 0.15, child: { kind: 'terminal', id: uid(), label: 'Succeeds (net of pilot)', value: 1120 } },
            { id: uid(), label: 'Weak market', prob: 0.85, child: { kind: 'terminal', id: uid(), label: 'Flops (net of pilot)', value: -480 } },
          ],
        },
      },
      { id: uid(), label: 'Stop', child: { kind: 'terminal', id: uid(), label: 'Walk away', value: -80 } },
    ],
  }
  p.tree = {
    kind: 'decision',
    id: uid(),
    label: 'Product launch ($k)',
    options: [
      { id: uid(), label: 'Launch now', child: launchNow },
      {
        id: uid(),
        label: 'Run a pilot first (−$80k)',
        child: {
          kind: 'chance',
          id: uid(),
          label: 'Pilot result',
          branches: [
            { id: uid(), label: 'Pilot positive', prob: 0.45, child: launchAfterPositive },
            { id: uid(), label: 'Pilot negative', prob: 0.55, child: launchAfterNegative },
          ],
        },
      },
      { id: uid(), label: 'Don’t launch', child: { kind: 'terminal', id: uid(), label: 'Status quo', value: 0 } },
    ],
  }
  return p
}

export const EXAMPLES: ExampleDef[] = [
  {
    key: 'job-offers',
    title: 'Job offer decision',
    blurb: 'Three options, three outcome attributes (comp, free time, fit), weighted multi-attribute utility. All four steps.',
    build: jobOffers,
  },
  {
    key: 'cancer',
    title: 'Treatment choice at 95',
    blurb: 'Inspired by BDA §9.2 (illustrative numbers): one outcome, three treatments — and the honest finding that they barely differ.',
    build: cancerTreatment,
  },
  {
    key: 'pilot',
    title: 'Pilot study, then launch',
    blurb: 'A sequential decision: launch now, run a pilot first, or pass. Rollback shows what the pilot’s information is worth.',
    build: pilotTree,
  },
]

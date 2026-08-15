# Decision Workbench

An interactive webapp that formalizes the four steps of Bayesian decision analysis from
Gelman, Carlin, Stern, Dunson, Vehtari & Rubin, *Bayesian Data Analysis* (3rd ed.), chapter 9 —
the pipeline **d → x → U(x)**.

Everything runs client-side: distributions are sampled with a seeded Monte Carlo engine in the
browser, projects autosave to local storage, and analyses can be exported/imported as JSON.

## The four steps, as implemented

| BDA step | In the app |
|---|---|
| 1. Enumerate the space of decisions *d* and outcomes *x* | **Specify** — list decision options and outcome attributes. Outcomes form a vector, each attribute marked *observable* (predictable quantity) or *unknown parameter*. |
| 2. Determine p(x\|d) — the outcome distribution under each decision | **Model** — per decision & attribute: point value, Normal, Log-normal, Uniform, scaled Beta, Discrete, or pasted posterior draws. Or paste *joint* draws (CSV from Stan/PyMC etc.) per decision, preserving dependence between attributes. All probabilities are conditional on *d*; there is no p(d). |
| 3. Define the utility function U(x) | **Utility** — three forms: a single outcome used as-is; a weighted multi-attribute trade-off (0–1 rescaling with reference points, exponential curvature for risk attitude, swing weights); or a custom formula over outcome variables (safe expression parser, no eval). |
| 4. Compute E[U(x)\|d] and pick the best decision | **Decide** — ranked expected utilities with Monte Carlo error bars, P(each decision is best), utility distributions as small multiples, and per-outcome uncertainty intervals. Verdicts flag margins that sit inside Monte Carlo noise. |

## Customizable journeys

- **Full analysis** — all four steps.
- **Quick compare** — the abbreviated version (steps 1–2 only): compare p(x|d) across decisions
  directly, no utility function.
- **Sequential decisions** — a decision-tree editor with live backward induction: chance nodes
  average over branches, decision nodes take the max, so expected utility is computed at each
  decision point conditional on the information available there. The optimal policy is highlighted.

Three worked examples ship with the app (multi-attribute job choice; a single-outcome treatment
choice inspired by BDA §9.2; a pilot-study-then-launch tree that shows the value of information).

## Develop

```sh
npm install
npm run dev        # local dev server
npm run build      # type-check + production build to dist/
npm run build:single  # fully inlined single-file build to dist-single/
```

Stack: Vite + React + TypeScript. No runtime dependencies beyond React; charts are hand-rolled SVG.

## Deploy

The build is a fully static site (no server, no API keys), so any static host works.

**Vercel (recommended):** import the repo at [vercel.com/new](https://vercel.com/new) — the
included `vercel.json` pins the Vite framework preset (`npm run build`, output `dist/`), so it
deploys with zero configuration. Or from the CLI: `npx vercel`.

**Netlify / Cloudflare Pages:** build command `npm run build`, publish directory `dist`.

**GitHub Pages:** `base: './'` is already set in `vite.config.ts`, so the build works from a
subpath — publish `dist/` with any Pages action.

There is no client-side routing, so no rewrite rules are needed anywhere.

## Notes on the math

- Sampling is seeded (mulberry32 + Box–Muller + Marsaglia–Tsang) so results are reproducible;
  the seed and draw count are editable in step 2.
- Independent marginals are an explicit simplification; the joint-draws import exists precisely
  so posterior correlation between attributes can flow through the analysis.
- Weighted utility: u(x) rescales each attribute to [0, 1] between user-set reference points
  (reverse them if less is better), applies exponential curvature
  u(t) = (1 − e^(−rt)) / (1 − e^(−r)), and combines with normalized swing weights.
- P(best) is estimated per simulated future across decisions; expected-utility whiskers show
  ±2 Monte Carlo standard errors, and the verdict says when a margin is within that noise.

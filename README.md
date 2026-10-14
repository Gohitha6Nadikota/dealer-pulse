# DealerPulse

A performance dashboard for a five-branch Toyota dealership group. It answers two questions:

- **For the CEO:** what's healthy, what isn't, and what should we do?
- **For branch managers:** which leads, orders and people need attention today?

- **Production:** https://dealer-pulse-mu.vercel.app
- **Repository:** https://github.com/Gohitha6Nadikota/dealer-pulse
- **Decisions, data findings and limitations:** [DECISIONS.md](DECISIONS.md)

> **Before reading the forecast:** 14 open leads are stored as "lost" in the CRM, but their history has no loss event, no loss reason and recent activity. The dashboard treats them as open and flags them. They swing the pipeline outlook from **~23 likely orders (~₹6.0 Cr)** to **~15 (~₹3.9 Cr)** if excluded, and all 7 of Lakeside Toyota's open leads are among them. Both figures are shown on `/funnel`; see [DECISIONS.md §5–6](DECISIONS.md#5-the-status-conflict-investigation-14-leads).

## Features

| Page | What it shows |
|---|---|
| **Overview** `/` | Rule-based headline ("Bookings are up 59% on Jul – Sep 2025 …; Lakeside Toyota needs attention …"), KPIs with period-over-period change, monthly bookings vs target, funnel, needs-attention summary, branch comparison with a health badge |
| **Branches** `/branches`, `/branches/[id]` | Branch KPIs, trend vs branch target, funnel vs company, sales officers, action items, open leads and orders |
| **Sales officer** `/reps/[id]` | Rank in branch, KPIs, trend, funnel vs branch, pipeline by stage, every assigned lead (search, sort, status tabs) with a timeline drawer |
| **Funnel & outlook** `/funnel` | Funnel reconciliation, leak detection by branch or officer (with sample-size and significance rules), loss reasons by stage, the status-conflict investigation, a qualified pipeline outlook |
| **Action Center** `/actions` | One row per lead needing action: severity, every reason, owner, next step, age, value; filters by branch, person, severity and reason |

Across all pages:

- **Filters live in the URL** (`?range=3m|6m|all`, `?from=2025-08&to=2025-10`, `?branch=B3`, and on `/actions` also `?reason=`, `?severity=`, `?owner=`), so every view is shareable and drill-down keeps the date range.
- **"Data as of 31 Dec 2025 UTC".** All "days idle" maths uses the data's latest timestamp, never the wall clock.
- **Data notes popover** in the header lists the data caveats.
- **Indian currency formatting** (₹8.4 Cr, ₹20.9 L) and UTC dates throughout.
- **Tooltips** define every metric.
- **States:** loading skeletons, empty states and an error boundary.
- **Responsive** for desktop and tablet; the sidebar becomes a drawer below 1024px.

## Tech stack

- **Next.js 16** (App Router, Cache Components, Partial Prefetching) and **React 19**
- **TypeScript** (strict, no `any`)
- **Tailwind CSS v4** and **shadcn/ui** (Radix primitives)
- **Recharts** for the bookings trend
- **Vitest** for tests; **tsx** runs the audit script
- No backend, database or auth. Deployed on **Vercel** with zero configuration.

## Architecture

```
public/data/dealership_data.json   synthetic dataset (Jun–Dec 2025)
lib/
  data.ts                server-only loader: import → validate → enrich → memoise
  analytics/
    validate.ts          runtime checks with path-specific errors
    enrich.ts            AS_OF, status from history, stage timestamps, idle days, data-quality flags
    definitions.ts       stage order, open stages, action thresholds
    kpis.ts trend.ts funnel.ts comparison.ts actions.ts     core metrics
    scope.ts             same KPIs/trend/funnel/actions for any set of leads
    health.ts insights.ts delta.ts                          health badge, headline, period deltas
    leaks.ts forecast.ts action-center.ts                   funnel leaks, outlook, action items
    overview.ts branch-view.ts rep-view.ts funnel-view.ts actions-view.ts   one view model per page
  filters.ts action-params.ts   URL ↔ filter state
  format.ts                     INR, percentages, UTC dates
app/                     routes; server components that build a view model and render it
components/              presentational components (dashboard, filters, leads, actions, funnel, ui)
proxy.ts                 returns a real 404 for unknown branch or officer IDs
scripts/audit-data.ts    prints the data-quality audit
```

- **Data stays on the server.** The JSON is read only on the server, all analytics run there, and client components receive the computed results or trimmed rows as props.
- **Pure, tested analytics.** Every metric is a pure function in `lib/analytics/`, and components only render.
- **Client code is limited to interaction:** the filter bars, the chart, the searchable tables and the timeline drawer.

## Getting started

**Prerequisites:** Node.js **20.9 or later** (Next 16 requirement; developed on Node 25) and npm.

```bash
git clone https://github.com/Gohitha6Nadikota/dealer-pulse.git
```
```bash
cd dealer-pulse
```
```bash
npm install
```
```bash
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run audit` | Data audit: shape, AS_OF, targets vs actuals, status/history conflicts, note contradictions, template bugs, delivery censoring, integrity |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest, once (208 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint (Next core-web-vitals and TypeScript rules) |

Full check before pushing:

```bash
npm run audit && npm run typecheck && npm test && npm run lint && npm run build
```

## Dataset and metric notes

The data is synthetic: 5 branches, 30 people (5 managers who own no leads, 25 sales officers), 510 leads with full status history, monthly targets and 160 deliveries, created June–December 2025. Key rules (full detail in [DECISIONS.md](DECISIONS.md)):

- **Booked sale** = a lead with an `order_placed` history entry, counted in that month. Delivered is secondary.
- **Status comes from the last history entry.** 14 leads stored as "lost" without a loss event are treated as open and flagged as status conflicts.
- **Win rate** = bookings ÷ (bookings + losses) in the selected months.
- **Period vs snapshot:** the date filter changes bookings, revenue, win rate, delivery time and the funnel. Open pipeline, awaiting delivery, action items and the outlook are snapshots as of AS_OF and say so.
- **Targets run ~7× actual volume** (1,426 target units vs 198 booked), so attainment is shown but health is judged against the company and the branch's own past.
- **Leaks** need at least 20 leads at a stage and a significant gap (z ≥ 2) vs the company.
- **The outlook** uses only creation months in which every lead is resolved (Jun–Nov, 435 leads). It estimates eventual orders, not a dated forecast, with a ~90% range.
- **UTC everywhere:** 31 Dec 2025 19:10 UTC is already 1 Jan in India.

## Testing

```bash
npm test
```

208 tests across 21 files cover:

- validation and enrichment
- every metric, the filters and URL round-trips, and formatting
- health rules and the headline insight
- the view models for each page
- Action Center prioritisation and de-duplication
- funnel reconciliation, leak and small-sample rules, and the forecast maths
- the status-conflict selector, warning wording and its independence from the date range, plus server-rendered markup of the warning and explainer
- real-dataset pins: the audited numbers, plus a hand-check of one branch (Lakeside) recomputed from raw JSON

UI flows were checked in headless Chrome (navigation, filters, the timeline drawer, 404s); there are no DOM component tests.

## Deployment

The app deploys to Vercel with zero configuration. Pushing to `main` triggers a production build:

```bash
git push origin main
```

The production URL is https://dealer-pulse-mu.vercel.app. Unknown branch or officer IDs (e.g. `/branches/B9`, or a manager such as `/reps/SR1`) return HTTP 404 via `proxy.ts`.

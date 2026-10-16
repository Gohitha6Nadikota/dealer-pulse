# DealerPulse: decisions, findings and limits

This document explains what DealerPulse shows, why it shows it that way, and where the data or the method runs out. Every number below comes from `npm run audit` or from the test suite, which pins the audited figures against the dataset (`lib/analytics/dataset.test.ts` and others).

**Read this first:** the pipeline outlook depends heavily on 14 leads whose CRM status contradicts their own history. With them it is about **23 orders**; without them it is about **15**, and the two ranges don't overlap. See [Forecast sensitivity](#the-14-status-conflicts-move-the-forecast-a-lot).

---

## 1. What I built and why

Two users, two questions:

- **The dealership CEO** asks "what's healthy, what isn't, and what do I do?". The **Overview** answers in one sentence (a rule-based headline), then shows KPIs, the bookings trend, the funnel and a branch comparison with a health badge.
- **Branch managers** ask "which leads and people need me today?". The **Action Center** lists every lead needing action, with the reason, the owner, the next step and the age. **Branch** and **sales officer** pages drill down with the same metrics.

Supporting pages:

- **Funnel & outlook** shows where leads leave the funnel, whether any branch or officer leaks more than chance would explain, the CRM status problem, and a qualified pipeline outlook.
- **Data notes** (a header popover) lists the data caveats in plain language.

| Route | Purpose |
|---|---|
| `/` | Overview: headline, KPIs, trend vs target, funnel, needs-attention summary, branch comparison (or one branch's officers with `?branch=`) |
| `/branches` | All branches with health |
| `/branches/[id]` | Branch KPIs, trend vs branch target, funnel vs company, officers, actions, open leads and orders |
| `/reps/[id]` | Officer KPIs, rank, trend, funnel vs branch, pipeline by stage, actions, all assigned leads with a timeline drawer |
| `/funnel` | Funnel reconciliation, leak matrix, loss reasons by stage, status-conflict investigation, pipeline outlook |
| `/actions` | Action Center: one row per lead with filters by branch, person, severity and reason |

---

## 2. The dataset

`public/data/dealership_data.json` contains synthetic data for June–December 2025.

| Collection | Rows | Notes |
|---|---|---|
| `branches` | 5 | Chennai (2), Bangalore, Hyderabad, Mumbai |
| `sales_reps` | 30 | 5 branch managers (own no leads) and 25 sales officers |
| `leads` | 510 | 2,068 `status_history` entries; created 1 Jun – 31 Dec 2025 |
| `targets` | 35 | One per branch per month (5 × 7), units and revenue |
| `deliveries` | 160 | Exactly the 160 leads with a `delivered` history entry |

**Integrity:** no duplicate IDs, no broken branch or rep references, no lead assigned to a rep from another branch, no non-positive deal values and no unparseable timestamps. History is always time-ordered, always starts at `new`, never skips or repeats a stage, and nothing follows a `lost` entry. `days_to_deliver`, `order_date` and `delivery_date` all agree with the history.

**Validation at load:** `lib/analytics/validate.ts` checks shapes, enum values, dates and references. It fails loudly with a path (e.g. `$.leads[3].status_history[0].status: unknown value "won"`) instead of letting a bad record skew a metric.

### "Today" is AS_OF, not the clock

`AS_OF` is the latest timestamp in the data: **31 Dec 2025, 19:10 UTC**. All "days idle", "days in stage" and "days waiting" use it, so the numbers don't drift as real time passes. There is no global header badge; every snapshot section labels its date instead ("Right now · as of 31 Dec 2025 (UTC)", the Needs attention card, the Action Center and the outlook), and Data notes explains the UTC choice.

---

## 3. Data-quality findings and how each is handled

| # | Finding (audited) | Handling |
|---|---|---|
| 1 | **Targets are ~7× actual volume.** 1,426 target units vs 198 booked (13.9%); ₹313 Cr target vs ₹47.5 Cr booked. Monthly unit attainment runs 3–18%. | Attainment is shown but never drives health or colour. The trend, the comparison with the company and the branch's own past carry the signal. Flagged in Data notes. |
| 2 | **14 leads stored as `lost` with no `lost` event and no `lost_reason`.** | Status is derived from the last history entry; these leads are treated as open and flagged. See [§5](#5-the-status-conflict-investigation-14-leads). |
| 3 | **42 of 274 loss notes contradict `lost_reason`** (e.g. note "went with Tata Harrier", reason "Financing not approved"). | Loss analysis uses the structured `lost_reason`. The count is disclosed on the funnel page. |
| 4 | **55 notes contain a literal `{}`** ("Customer comparing with {} competitor"). | Sanitised for display to "comparing with a competitor"; the raw count is kept. |
| 5 | **Delivery times rose sharply.** Mean days to deliver by order month: Jun 13.5, Jul 13.9, Aug 14.2, Sep 15.0, **Oct 20.1, Nov 28.9**, Dec 13.3. 55 of the 72 recorded delay reasons fall on Oct–Nov orders. | Shown on the KPI strip and trend tooltip. **December is right-censored:** only 22 of its 36 orders are delivered, so its average is biased low. The tooltip shows the completeness ("61% delivered so far"). |
| 6 | **38 orders are awaiting delivery; 25 have waited more than 21 days.** 14 have waited 21–90 days; **11 have waited 90+ days, the longest 195** (placed in June), while the slowest delivery ever recorded took 39 days. | The 14 are genuine **delayed deliveries** (owner: branch manager, "Chase delivery"). The 11 are **likely stale records**, more plausibly cancelled or delivered-but-not-logged than late (owner: sales officer, "Verify status in CRM"). Only the 14 count in headlines and revenue at risk. The 90-day cut-off is `THRESHOLDS.staleOrderDays`. The data only records `delay_reason` for delivered orders, so neither group has one. |
| 7 | Branch managers own no leads. | They have no officer page (their IDs 404); they own delivery chasing in the Action Center. |

---

## 4. Metric definitions

All rules live in `lib/analytics/definitions.ts`; tooltips in `lib/metric-help.ts` repeat them.

| Metric | Definition |
|---|---|
| **Stage reached** | A lead reached a stage if any history entry has that status. Never inferred from the stored `status`. |
| **Current status** | Status of the last history entry. |
| **Booked sale (primary KPI)** | A lead with an `order_placed` entry, counted in the month of that entry. Delivered is secondary because delivery lags 1–5 weeks and would penalise recent months. |
| **Booked revenue** | Sum of `deal_value` for booked leads. |
| **Win rate** | Bookings ÷ (bookings + losses), each counted in the month the event happened. It counts deals won or lost *during* the period; the funnel counts leads *created* in the period, so the two can differ. The tooltip says so. |
| **Target attainment** | Booked ÷ target for the same branch and months. `null` (shown "—"), not 0%, when there is no target (reps have none). |
| **Open pipeline** | Current status `new`, `contacted`, `test_drive` or `negotiation`. |
| **Awaiting delivery** | Current status `order_placed`; a separate bucket, not pipeline. |
| **Avg delivery time** | Mean `days_to_deliver` for orders placed in the range that have been delivered. |
| **Days idle** | AS_OF − `last_activity_at` (identical to the last history timestamp in this data). |
| **Days in stage** | AS_OF − timestamp of the last history entry. |
| **Funnel cohort** | Leads created in the selected months, with the furthest stage each reached. |
| **Stage conversion** | Reached stage N+1 ÷ reached stage N. |

### Monthly bookings chart

Opens on **attainment %** (units booked ÷ target units, by order month) when the scope has targets; officers have none, so their chart opens on units. Units and Revenue stay one click away. Targets run about 7× actual volume, so on a shared axis they flatten the bars. The y-axis is therefore capped near 1.5× the largest bar, rounded to a round number with even ticks (`lib/analytics/trend-scale.ts`). A target above the cap is not drawn; the legend labels it "Target off-scale" with its value (100% for attainment, 181–240 units a month for the company). A target that fits under the cap is drawn as usual.

### Period metrics vs snapshots

The date filter (`?range=3m|6m|all` or `?from=YYYY-MM&to=YYYY-MM`) changes **period metrics**: bookings, revenue, attainment, win rate, delivery time, the funnel cohort and leak analysis. It does **not** change **snapshots** taken at AS_OF: open pipeline, awaiting delivery, every action list, the status-conflict list and the pipeline outlook. The UI puts these in separately labelled groups ("Performance · Oct – Dec 2025" vs "Right now · as of 31 Dec 2025 (UTC)"), and every snapshot card says it isn't affected by the date filter.

**Default range: last 3 months (Oct – Dec 2025).** It is compared with the previous equal-length period (Jul – Sep), so KPIs have meaningful trend arrows. When no complete earlier period exists ("Last 6 months", "All time"), arrows are hidden and the UI says so.

**Small bases:** below 10 bookings in the previous period, changes are stated as counts ("5 cars booked … vs 4") and percentage arrows are withheld. "Up 25%" on 4 → 5 is noise.

---

## 5. The status-conflict investigation (14 leads)

**What the data says:** 14 leads have `status: "lost"`, but their `status_history` contains no `lost` event and their `lost_reason` is null. Their histories end at an in-progress stage: 2 New, 6 Contacted, 4 Test drive, 2 Negotiation.

**Why I treat them as open, not lost:**

1. **No loss event and no loss reason.** Every one of the 274 genuine losses has both; these have neither.
2. **They are all recent and active.** All were created between 6 and 31 Dec 2025, and none has been idle more than 11 days.
3. **Their latest notes describe progress, not a loss**, e.g. "Final pricing discussion, close expected", "Test drive completed, customer impressed", "Discussed financing options".
4. **They are concentrated at one branch.** **Lakeside Toyota has 7 of the 14, which is every open lead it has.** Not one in-progress Lakeside lead has a correct stored status. That points to a CRM sync or data-entry fault at the branch, not to 7 customers walking away at once.

**How they appear:** derived status (open at their last stage), labelled "Stored as lost" wherever they're listed. They are **never counted as losses**: the funnel puts them in "still here (stored as lost)". They appear in the Action Center as "Status conflict" items (severity "Review" unless they're also idle) so someone corrects the record. The funnel page has a dedicated investigation section with the breakdown by branch.

**Where the warning shows:** a compact "CRM data quality issue" notice near the top of the Overview, and of any branch or officer page with affected leads. It links to `/actions?reason=status_conflict`, where an explainer covers what is inconsistent, how it is treated and why it needs review. Open-pipeline figures and the branch table say how many leads are "stored as lost", and funnels note that these are excluded from genuine losses. The notice is never date-filtered: the finding is about the dataset, not a period. It reads from one shared selector (`lib/analytics/status-conflicts.ts`), never from a hard-coded list.

**The honest caveat:** the data can't prove these leads are alive. It can only show the stored status has no evidence behind it. That uncertainty is why the forecast is shown both ways (next section).

---

## 6. Forecast (pipeline outlook)

**What it is:** how many of today's 38 open leads are likely to order **eventually**. It is not a sales forecast for January and not a target.

### Method (`lib/analytics/forecast.ts`)

1. **History window: fully resolved cohorts only.** Every lead created in Jun–Nov 2025 (435 leads) has already ordered or been lost. December has 37 of 75 resolved, so it is excluded: including it would bias rates by counting leads that haven't had time to be lost or ordered. The window is detected from the data, not hard-coded.
2. **Chance of ordering from each stage** = leads in the window that reached the stage and later ordered ÷ leads in the window that reached it:

   | Stage | Ordered / reached | Chance |
   |---|---|---|
   | New | 188 / 435 | 43% |
   | Contacted | 188 / 338 | 56% |
   | Test drive | 188 / 267 | 70% |
   | Negotiation | 188 / 216 | 87% |

3. **Expected value** = Σ over open leads of (chance at its current stage × deal value).
4. **Range (~90%)** = mean ± 1.645 σ, treating each lead as an independent yes/no outcome (variance Σ v²·p·(1−p)), clamped to what is possible.
5. **Branch scope:** a branch uses its **own** rate at a stage where it has at least 20 past leads there, otherwise the company rate. Each row is labelled. Lakeside therefore uses its own 16% / 26% / 42% for the early stages (against 43% / 56% / 70% company-wide) and the company 87% at negotiation, where it has only 13 past leads.

### Result (all branches)

| | Open leads | Pipeline value | Likely orders (~90% range) | Likely value (~90% range) |
|---|---|---|---|---|
| **As recorded (conflicts treated as open)** | 38 | ₹9.77 Cr | **~23** (18–29) | **~₹6.0 Cr** (₹4.7–7.4 Cr) |
| **Excluding the 14 status conflicts** | 24 | ₹6.57 Cr | **~15** (10–19) | **~₹3.9 Cr** (₹2.8–5.1 Cr) |

### The 14 status conflicts move the forecast a lot

- The 14 conflicted leads are **37% of the open pipeline** (14 of 38) and contribute **~8.8 expected orders and ~₹2.1 Cr**, because they sit at the same stages as everyone else and get the same probabilities.
- The two 90% ranges **don't overlap** (18–29 vs 10–19). Whether these records are trusted changes the answer more than all the statistical uncertainty.
- **At Lakeside, the whole outlook rests on them:** ~2.4 expected orders with them, **0** without, because all 7 of its open leads are conflicted.

**What to do with that:** read ~23 as the outlook *if* the CRM statuses are simply wrong (which the history and notes suggest), and ~15 as the floor *if* those leads really are lost. Fixing the 14 records (Action Center → Status conflict) collapses that gap and is the cheapest way to make the forecast trustworthy. The page shows both figures side by side for this reason.

### Assumptions and limitations

- **Behaviour stays as it was in Jun–Nov.** No seasonality, pricing or staffing changes are modelled.
- **The range covers outcome luck only.** It ignores uncertainty in the rates themselves and any change in behaviour, so real uncertainty is wider.
- **No timing.** The page shows median days from each stage to order (~20 from New, ~8 from Negotiation) for orientation only.
- **Leads idle for long are treated like any other lead at their stage.** The data has no evidence to discount them.
- **The pipeline is small (38 leads)**, so a few large deals swing the total.
- **Not modelled:** cancellations after ordering (none occur in the data) and orders from leads not yet created.

---

## 7. Funnel reconciliation and leak detection

### Reconciliation (`reconcileFunnel`)

At every stage, every lead that reached it is counted exactly once:

> **reached = moved on + lost here + still here**

"Lost here" counts genuine loss events only. "Still here" includes leads currently at the stage, with the status-conflict subset shown separately. The cohort total also reconciles:

> 510 leads = 160 delivered + 38 awaiting delivery + 38 open (14 stored as lost) + 274 lost

Tests check both identities for the company, every branch and every officer, and check that reached and lost counts match the existing funnel and data-quality counts (`lib/analytics/leaks.test.ts`).

### Leak rule (`leakCells`)

- **Loss rate at a stage** = lost there ÷ reached it.
- **Benchmark:** the company's loss rate at that stage, for the same cohort. Officers are also compared with the company, not their branch, so a weak branch can't hide a weak officer.
- **Minimum sample: 20 leads reaching the stage.** Below that, the cell is shown with "Fewer than 20" and is **not judged or ranked**.
- **"Leak" requires z ≥ 2**, where z = (rate − benchmark) ÷ √(benchmark·(1−benchmark)/n). Roughly: a gap this size would happen by chance less than ~5% of the time. "Better" uses z ≤ −2.
- **Ranking** is by excess losses, i.e. losses beyond what the company rate predicts for that many leads.

**Result (all time):** only Lakeside Toyota leaks, at three stages:

| Stage | Lakeside | Company | Excess losses |
|---|---|---|---|
| New | 39% (31 of 79) | 22% | ~14 |
| Contacted | 35% (16 of 46) | 19% | ~7 |
| Test drive | 44% (12 of 27) | 18% | ~7 |
| Negotiation | 21% (3 of 14) | 14% | too few to judge |

No other branch differs from the company beyond chance at any stage. Most officer-level cells have fewer than 20 leads and are explicitly not judged. The page says this rather than ranking noise.

**Censoring caveat:** recent leads are in the denominators but have had less time to be lost, so loss rates for recent ranges are biased low. The funnel description says so.

---

## 8. Action Center rules

**One row per lead, every reason listed.** A negotiation idle for 12 days is one item with two reasons, not two items. That's why the "Leads needing action" count (45) is lower than the sum of the reason counts (52), and the UI says so. Value totals count each lead once.

| Reason | Condition (as of AS_OF) | Owner | Next step |
|---|---|---|---|
| Delayed delivery | `order_placed`, not delivered, more than 21 and under 90 days | Branch manager | Chase delivery and update the customer |
| Likely stale record | `order_placed`, not delivered, 90+ days | Sales officer | Verify the order's status in the CRM |
| Stalled negotiation | In negotiation ≥ 10 days | Sales officer | Push to a decision |
| Idle lead | Open, no activity ≥ 7 days | Sales officer | Follow up |
| Past expected close | Open, `expected_close_date` before AS_OF | Sales officer | Re-confirm timing |
| Status conflict | Stored "lost" with no loss event | Sales officer | Correct the CRM status |

- **Thresholds** (7 / 10 / 21 days, and 90 for likely stale records) are constants in `THRESHOLDS` (`lib/analytics/definitions.ts`). 90 is deliberately conservative: no recorded delivery took more than 39 days.
- **Severity is my convention**, documented in the UI tooltip:
  - "Act now" at **twice** a threshold (idle 14+, negotiation 20+, waiting 42–89).
  - "Watch" at the threshold, or past the expected close date.
  - "Review" for records to verify: likely stale orders (90+ days), or a status conflict as the only reason.
  - A lead takes its worst reason's severity.
- **Ordering** is severity, then deal value × days.
- **Person filter:** filtering by a person shows items they own *or* leads assigned to them, so an officer also sees the delayed orders on their own customers.

**Value at risk** counts each lead once and excludes "Review" items, because a record to verify isn't revenue slipping. The Action Center total and the Overview's "Needs attention" total use the same definition and agree (₹6.3 Cr); a test enforces it. The Action Center also shows the excluded amount ("excl. ₹4.1 Cr in records to verify"). An earlier version of the "Needs attention" total added its lists together, which counted a negotiation that was also idle twice. That is fixed.

**Current state:** 45 leads (11 Act now, 12 Watch, 22 Review); 14 delayed deliveries, 11 likely stale records, 9 idle leads, 2 stalled negotiations, 2 past their expected close, 14 status conflicts.

---

## 9. Branch health badge

Targets can't drive health (every branch would be red), so health compares each branch with **the company** and with **its own previous period**. It uses three inputs: win rate vs the company average, bookings vs the branch's own previous period, and delivery time vs the company average. It does **not** use target attainment, because targets look unreachable relative to the data. The badge tooltip (every badge, healthy ones included) and the branch comparison say this, with a link that opens Data notes.

- **Act now (red):** win rate under 75% of the company's, or bookings down more than 25% vs the previous period.
- **Watch (amber):** win rate under 90% of the company's, bookings down more than 10%, or average delivery time over 125% of the company's.
- **Healthy (green):** otherwise.

The win-rate rules need at least 5 outcomes. Comparison rules are skipped when there's no previous period. The badge always carries an icon and a label, never colour alone, and hover or focus shows the reasons. Rules live in `lib/analytics/health.ts`. Result: Lakeside is "Act now" in every range (win rate 13–14% vs 42–46%).

---

## 10. Key product decisions and tradeoffs

| Decision | Why | Tradeoff |
|---|---|---|
| **Booked, not delivered**, as the primary KPI | Delivery lags 1–5 weeks and the lag lengthened sharply in Oct–Nov; counting deliveries would punish recent months for operations, not sales. | Delivered is shown as a secondary figure. |
| **Status from history**, not the stored field | History is internally consistent; the stored field contradicts it 14 times. | Those 14 are shown as "stored as lost" everywhere rather than silently fixed. |
| **Targets shown, not trusted** | ~7× mismatch; a wall of red helps nobody. | Attainment is still visible, with the mismatch explained. |
| **Server-side analytics** | No client fetch waterfall or loading flash; the browser never downloads the raw dataset through the app (the file is still public in `/public`, which is fine for synthetic data). | Every filter change is a server round trip, made smooth by React transitions. |
| **Filters in the URL** | Shareable views; drill-down keeps the date range. | Slightly more plumbing (`lib/filters.ts`). |
| **No backend, database or auth** | Static synthetic data; the brief asked for simple. | Real use would need a CRM sync. |
| **Rule-based headline, not an LLM** | Deterministic, testable, explainable. | Less nuanced prose. |

---

## 11. Technical architecture

- **Next.js 16 App Router** with Cache Components and Partial Prefetching (scaffold defaults). Pages ship a static shell; URL-dependent content streams inside `<Suspense>` with skeletons, and filter changes run in a React transition (old view dimmed, `aria-busy`).
- **Data flow:** `lib/data.ts` (`server-only`) imports the JSON (bundled into the server build only), validates it (`validate.ts`), enriches it once (`enrich.ts`: derived status, stage timestamps, AS_OF, idle days, data-quality flags) and memoises it.
- **Analytics** in `lib/analytics/` are pure functions. `scope.ts` computes the same KPIs, trend, funnel and actions for any set of leads (company, branch or officer), so all pages agree by construction. Each page has a view model (`overview.ts`, `branch-view.ts`, `rep-view.ts`, `funnel-view.ts`, `actions-view.ts`); components render and don't compute.
- **Client components** are limited to the filter bars, the chart, the lead and action tables (search, sort, timeline drawer) and navigation. They receive trimmed rows (no phone numbers, notes already sanitised).
- **Real 404s:** detail pages are prerendered via `generateStaticParams`, but with streaming a `notFound()` inside the page would return HTTP 200. `proxy.ts` checks branch and officer IDs against the dataset before rendering and rewrites unknown ones to the not-found page, giving a true 404.
- **UI:** Tailwind v4 and shadcn/ui (Radix), Recharts for the trend chart, one accent colour (blue), and status colours (green, amber, red) reserved for health and severity, always with an icon and a label.
- **Tests:** Vitest, 254 tests across 26 files covering validation, enrichment, every metric, filters and URLs, formatting, health, insights, view models, action prioritisation, funnel reconciliation, leak rules, the forecast maths, the status-conflict warning (including server-rendered markup) and real-data pins.

### UTC handling

Timestamps are stored in UTC. Months are bucketed in UTC and dates formatted in UTC (`lib/format.ts`, not `date-fns`, whose `format` uses the local zone). AS_OF is 31 Dec 2025 19:10 UTC, which is already 1 Jan in India; showing it in local time would put the "as of" date in the wrong year. Every "as of" label says UTC, timeline entries show the time with "UTC", and the Data notes popover explains this. Currency is formatted the Indian way: ₹8.4 Cr, ₹20.9 L, ₹2,29,70,000.

---

## 12. Interesting patterns in the data

1. **Lakeside Toyota is the outlier on everything.** 10 bookings against a 264-unit target (3.8% vs 15–19% elsewhere); loses 39% of leads before first contact; 14% win rate vs 42% company-wide; and every one of its open leads has a broken CRM status.
2. **Delivery is the company-wide operational story.** Order-to-delivery time rose to 20.1 days for October orders and 28.9 for November, against ~14 for Jun–Sep, and 14 orders are delayed 21–90 days. A further 11 have been open 90+ days (since as early as June), which looks like stale CRM records rather than delays. Orders with a recorded delay reason averaged 25.2 days vs 12.7 without.
3. **Demand grew in Q4.** Leads created rose from 55–70 a month (Jun–Sep) to 90–95 (Oct–Nov); bookings Oct–Dec were 59% above Jul–Sep (118 vs 74).
4. **Losses are spread across reasons**, with no single dominant cause ("Better offer elsewhere" and "Not ready to purchase" lead at 40 each, 15%). Competitor-related reasons account for about a quarter of losses.
5. **Late stages convert well.** Once in negotiation, 87% of resolved leads ordered; the leak is early in the funnel.
6. **Lead sources** (`/funnel`, leads created in the selected range, win rate = won ÷ (won + genuinely lost)): walk-in converts best (62%, 83 won vs 50 lost) and social media worst (19%), a 44-point spread, so the "source doesn't predict conversion" line stays off.
7. **Car models** (`/funnel`, same cohort and win rate, sorted by booked revenue): Fortuner earns the most (₹15 Cr, 32% of booked revenue) and Glanza has the most leads (130); Hilux (11 leads) is flagged as fewer than 20.

---

## 13. Known limitations and deviations from the brief

- **`stuckOrders` and delay reasons:** the brief wanted each stuck order to show its `delay_reason`. The data only has delay reasons for delivered orders, so stuck orders have none. A separate "Why deliveries ran late" summary uses the delivered history instead.
- **Forecast:** eventual orders, not dated; no what-if slider (listed as a stretch goal).
- **Loss-reason breakdown** is a table by stage, not a chart. The stage split was more useful than a bar chart of the same counts.
- **Funnel visual** is accessible HTML bars, not Recharts.
- **The `source` field is unreliable.** It matches the channel named in the lead's first history note ("Walk-in enquiry…", "DM on Instagram…") for only 82 of 510 leads (16%), about what chance alone gives (17%). The data can't tell which field is right, so source win rates are shown with that caveat on the card and shouldn't drive spend decisions on their own.
- **Censoring:** recent months are biased in delivery time (low), funnel conversion and loss rates; disclosed where shown.
- **Synthetic data:** patterns (e.g. "Customer requested date change" as the top delay reason) may not generalise.
- **Severity tiers** (2× threshold) are a convention, not a business rule from the brief.
- **The 90-day stale cut-off** is a heuristic from the data (slowest delivery 39 days), not a confirmed business rule. Orders between 40 and 89 days are still treated as genuine delays.
- **Officers are benchmarked against the company**, not their branch.
- **Tests** cover logic and view models; interactions were checked in headless Chrome, not with DOM component tests.
- **`date-fns`** is installed as specified but unused; see UTC handling above.
- **Tablet (768px):** wide tables (Action Center, lead tables) scroll horizontally; the sidebar becomes a drawer below 1024px.
- **Branch managers** have no page because they own no leads.

## 14. What I'd build next

1. **Write-back for status conflicts:** let a manager confirm or correct a lead's status from the Action Center (needs a CRM integration).
2. **Alerts:** a daily WhatsApp or email digest of each person's "Act now" items.
3. **Anomaly detection:** flag sudden drops in a branch's weekly bookings or jumps in delivery time automatically.
4. **What-if and dated forecast:** stage-conversion sliders and a time-to-order model for "expected bookings by month".
5. **LLM summaries:** a natural-language weekly brief generated from the same rule-based facts, with the numbers still computed deterministically.
6. **Export and share:** PDF or CSV of any filtered view.
7. **Real-time sync** with the CRM instead of a static JSON snapshot.

/**
 * Data audit for public/data/dealership_data.json.
 *
 * Prints the real numbers behind each suspected data issue so that the
 * analytics layer is built on verified facts, not assumptions.
 * Run with: npm run audit
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RawDataset, RawLead } from "../lib/types";

const raw = JSON.parse(
  readFileSync(join(process.cwd(), "public/data/dealership_data.json"), "utf8"),
) as RawDataset;
const { leads, sales_reps: reps, branches, targets, deliveries } = raw;

const DAY_MS = 86_400_000;
const ts = (s: string) => new Date(s).getTime();
const iso = (n: number) => new Date(n).toISOString();
const month = (s: string) => s.slice(0, 7);
const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const countBy = <T>(xs: T[], key: (x: T) => string) =>
  xs.reduce<Record<string, number>>((m, x) => {
    const k = key(x);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
const section = (title: string) => console.log(`\n=== ${title} ===`);
const last = <T>(xs: T[]) => xs[xs.length - 1];
const historyEntry = (l: RawLead, status: string) =>
  l.status_history.find((h) => h.status === status);

// ---------------------------------------------------------------------------
section("0. Shape");
console.log({
  branches: branches.length,
  reps: reps.length,
  leads: leads.length,
  targets: targets.length,
  deliveries: deliveries.length,
  historyEntries: leads.reduce((n, l) => n + l.status_history.length, 0),
});
console.log("roles", countBy(reps, (r) => r.role));
console.log("status field", countBy(leads, (l) => l.status));
console.log(
  "history statuses",
  countBy(
    leads.flatMap((l) => l.status_history),
    (h) => h.status,
  ),
);
console.log(
  "created_at range",
  leads.map((l) => l.created_at).sort()[0],
  "→",
  leads.map((l) => l.created_at).sort().at(-1),
);
console.log("leads created per month", countBy(leads, (l) => month(l.created_at)));
const values = leads.map((l) => l.deal_value).sort((a, b) => a - b);
console.log("deal_value min/median/max", values[0], values[values.length >> 1], values.at(-1));

// ---------------------------------------------------------------------------
section("1. AS_OF (latest timestamp in the data)");
const historyMax = Math.max(
  ...leads.flatMap((l) => l.status_history.map((h) => ts(h.timestamp))),
);
const activityMax = Math.max(...leads.map((l) => ts(l.last_activity_at)));
const deliveryMax = Math.max(
  ...deliveries.flatMap((d) => [ts(d.order_date), ts(d.delivery_date)]),
);
console.log("max status_history timestamp", iso(historyMax));
console.log("max last_activity_at        ", iso(activityMax));
console.log("max delivery/order date     ", iso(deliveryMax));
console.log("AS_OF                       ", iso(Math.max(historyMax, deliveryMax)));
const activityMismatch = leads.filter(
  (l) => l.last_activity_at !== last(l.status_history).timestamp,
);
console.log(
  "leads where last_activity_at ≠ last history timestamp:",
  activityMismatch.length,
);
console.log(
  "  of which last_activity_at is LATER than last history entry:",
  activityMismatch.filter(
    (l) => ts(l.last_activity_at) > ts(last(l.status_history).timestamp),
  ).length,
);

// ---------------------------------------------------------------------------
section("2. Targets vs actual bookings (order_placed history entries)");
const booked = leads.filter((l) => historyEntry(l, "order_placed"));
const bookedMonth = (l: RawLead) => month(historyEntry(l, "order_placed")!.timestamp);
const months = [...new Set(targets.map((t) => t.month))].sort();
const rows = months.map((m) => {
  const t = targets.filter((x) => x.month === m);
  const b = booked.filter((l) => bookedMonth(l) === m);
  const targetUnits = t.reduce((n, x) => n + x.target_units, 0);
  const targetRevenue = t.reduce((n, x) => n + x.target_revenue, 0);
  const revenue = b.reduce((n, l) => n + l.deal_value, 0);
  return {
    month: m,
    targetUnits,
    bookedUnits: b.length,
    unitAttain: `${round((b.length / targetUnits) * 100)}%`,
    targetRevCr: round(targetRevenue / 1e7, 2),
    bookedRevCr: round(revenue / 1e7, 2),
    revAttain: `${round((revenue / targetRevenue) * 100)}%`,
  };
});
console.table(rows);
const bookedOutside = booked.filter((l) => !months.includes(bookedMonth(l)));
console.log("booked leads whose booking month has no target:", bookedOutside.length);
console.table(
  branches.map((b) => {
    const tu = targets
      .filter((t) => t.branch_id === b.id)
      .reduce((n, t) => n + t.target_units, 0);
    const bu = booked.filter((l) => l.branch_id === b.id).length;
    return { branch: b.id, name: b.name, targetUnits: tu, bookedUnits: bu, attain: `${round((bu / tu) * 100)}%` };
  }),
);
console.log(
  "target rows per branch×month:",
  targets.length,
  "expected",
  branches.length * months.length,
  "| duplicate branch×month:",
  targets.length - new Set(targets.map((t) => `${t.branch_id}|${t.month}`)).size,
);

// ---------------------------------------------------------------------------
section("3. Status field vs status_history");
const lostNoEvent = leads.filter((l) => l.status === "lost" && !historyEntry(l, "lost"));
console.log("status='lost' but no lost history entry:", lostNoEvent.length);
console.log(
  "  …and lost_reason is null:",
  lostNoEvent.filter((l) => l.lost_reason == null).length,
);
console.log(
  "  last real history stage of those:",
  countBy(lostNoEvent, (l) => last(l.status_history).status),
);
const lastMismatch = leads.filter((l) => last(l.status_history).status !== l.status);
console.log("last history status ≠ status field:", lastMismatch.length);
console.log(
  "  breakdown (status field ← last history):",
  countBy(lastMismatch, (l) => `${l.status} ← ${last(l.status_history).status}`),
);
console.log(
  "lost history entry but lost_reason null:",
  leads.filter((l) => historyEntry(l, "lost") && l.lost_reason == null).length,
);
console.log(
  "lost_reason set but no lost history entry:",
  leads.filter((l) => !historyEntry(l, "lost") && l.lost_reason != null).length,
);
console.log(
  "lost_reason set but status ≠ lost:",
  leads.filter((l) => l.status !== "lost" && l.lost_reason != null).length,
);

// Stage ordering inside history.
const ORDER = ["new", "contacted", "test_drive", "negotiation", "order_placed", "delivered"];
const unsorted = leads.filter((l) =>
  l.status_history.some((h, i, a) => i > 0 && ts(h.timestamp) < ts(a[i - 1].timestamp)),
);
const notStartingNew = leads.filter((l) => l.status_history[0]?.status !== "new");
const createdMismatch = leads.filter((l) => l.status_history[0]?.timestamp !== l.created_at);
const regress = leads.filter((l) => {
  const idx = l.status_history.filter((h) => h.status !== "lost").map((h) => ORDER.indexOf(h.status));
  return idx.some((v, i) => i > 0 && v <= idx[i - 1]);
});
const skipped = leads.filter((l) => {
  const idx = l.status_history.filter((h) => h.status !== "lost").map((h) => ORDER.indexOf(h.status));
  return idx.some((v, i) => i > 0 && v - idx[i - 1] > 1);
});
const afterLost = leads.filter((l) => {
  const i = l.status_history.findIndex((h) => h.status === "lost");
  return i >= 0 && i < l.status_history.length - 1;
});
console.log("history not sorted by time:", unsorted.length);
console.log("history not starting with 'new':", notStartingNew.length);
console.log("first history timestamp ≠ created_at:", createdMismatch.length);
console.log("history goes backwards / repeats a stage:", regress.length);
console.log("history skips a stage:", skipped.length);
console.log("entries after a 'lost' entry:", afterLost.length);
console.log("history length distribution:", countBy(leads, (l) => String(l.status_history.length)));

// ---------------------------------------------------------------------------
section("4. Loss reason vs final note");
const lostLeads = leads.filter((l) => historyEntry(l, "lost"));
const lostNotes = countBy(lostLeads, (l) => historyEntry(l, "lost")!.note ?? "");
console.log("distinct notes on lost entries:", Object.keys(lostNotes).length);
console.log(lostNotes);
const COMPETITOR = /hyundai|maruti|kia|honda|tata|mahindra|\bmg\b|skoda|volkswagen|competitor|creta|seltos/i;
const contradict = lostLeads.filter((l) => {
  const note = historyEntry(l, "lost")!.note ?? "";
  return COMPETITOR.test(note) && l.lost_reason !== "Chose competitor brand" && l.lost_reason !== "Better offer elsewhere";
});
console.log(
  "lost notes naming a competitor while lost_reason is something else:",
  contradict.length,
  "of",
  lostLeads.length,
);
console.log(
  "  examples:",
  contradict.slice(0, 3).map((l) => ({ id: l.id, note: historyEntry(l, "lost")!.note, lost_reason: l.lost_reason })),
);

// ---------------------------------------------------------------------------
section("5. Template bugs in notes");
const allNotes = leads.flatMap((l) => l.status_history.map((h) => ({ id: l.id, note: h.note ?? "" })));
const braces = allNotes.filter((n) => n.note.includes("{}"));
const otherTemplate = allNotes.filter((n) => /\{[^}]+\}|undefined|null|NaN/.test(n.note));
console.log("notes containing literal '{}':", braces.length, "across leads:", new Set(braces.map((n) => n.id)).size);
console.log("  distinct:", [...new Set(braces.map((n) => n.note))]);
console.log("notes with other placeholder residue ({x}, undefined, null, NaN):", otherTemplate.length);
console.log("empty notes:", allNotes.filter((n) => !n.note.trim()).length);

// ---------------------------------------------------------------------------
section("6. Deliveries");
const deliveredLeads = leads.filter((l) => historyEntry(l, "delivered"));
const deliveryIds = new Set(deliveries.map((d) => d.lead_id));
const leadIds = new Set(leads.map((l) => l.id));
console.log("leads with delivered history entry:", deliveredLeads.length);
console.log("  …missing from deliveries[]:", deliveredLeads.filter((l) => !deliveryIds.has(l.id)).length);
console.log("deliveries rows whose lead is not delivered:", deliveries.filter((d) => !historyEntry(leads.find((l) => l.id === d.lead_id)!, "delivered")).length);
console.log("deliveries rows with unknown lead_id:", deliveries.filter((d) => !leadIds.has(d.lead_id)).length);
console.log("duplicate delivery lead_ids:", deliveries.length - deliveryIds.size);
const wrongDays = deliveries.filter(
  (d) => Math.round((ts(d.delivery_date) - ts(d.order_date)) / DAY_MS) !== d.days_to_deliver,
);
console.log("days_to_deliver ≠ delivery_date − order_date:", wrongDays.length);
const byId = new Map(leads.map((l) => [l.id, l]));
const orderDateMismatch = deliveries.filter(
  (d) => historyEntry(byId.get(d.lead_id)!, "order_placed")?.timestamp.slice(0, 10) !== d.order_date,
);
const deliveryDateMismatch = deliveries.filter(
  (d) => historyEntry(byId.get(d.lead_id)!, "delivered")?.timestamp.slice(0, 10) !== d.delivery_date,
);
console.log("order_date ≠ order_placed history date:", orderDateMismatch.length);
console.log("delivery_date ≠ delivered history date:", deliveryDateMismatch.length);
console.table(
  Object.entries(
    deliveries.reduce<Record<string, number[]>>((m, d) => {
      (m[month(d.order_date)] ??= []).push(d.days_to_deliver);
      return m;
    }, {}),
  )
    .sort()
    .map(([m, xs]) => ({
      orderMonth: m,
      delivered: xs.length,
      avgDays: round(avg(xs)),
      min: Math.min(...xs),
      max: Math.max(...xs),
      ordersThatMonth: booked.filter((l) => bookedMonth(l) === m).length,
    })),
);
console.log(
  "delay_reason present by order month:",
  countBy(deliveries.filter((d) => d.delay_reason), (d) => month(d.order_date)),
);
console.log(
  "avg days with vs without delay_reason:",
  round(avg(deliveries.filter((d) => d.delay_reason).map((d) => d.days_to_deliver))),
  "vs",
  round(avg(deliveries.filter((d) => !d.delay_reason).map((d) => d.days_to_deliver))),
);
const asOf = Math.max(historyMax, deliveryMax);
const awaiting = leads.filter((l) => historyEntry(l, "order_placed") && !historyEntry(l, "delivered") && !historyEntry(l, "lost"));
console.log("orders awaiting delivery (booked, not delivered, not lost):", awaiting.length);
console.log(
  "  days waiting as of AS_OF:",
  awaiting
    .map((l) => Math.floor((asOf - ts(historyEntry(l, "order_placed")!.timestamp)) / DAY_MS))
    .sort((a, b) => a - b)
    .join(", "),
);
console.log(
  "booked then lost (order_placed AND lost entries):",
  leads.filter((l) => historyEntry(l, "order_placed") && historyEntry(l, "lost")).length,
);

// ---------------------------------------------------------------------------
section("7. Integrity");
const dup = (xs: string[]) => xs.length - new Set(xs).size;
console.log("duplicate ids → leads/reps/branches:", dup(leads.map((l) => l.id)), dup(reps.map((r) => r.id)), dup(branches.map((b) => b.id)));
console.log("duplicate customer (name+phone):", dup(leads.map((l) => `${l.customer_name}|${l.phone}`)));
console.log("duplicate phone:", dup(leads.map((l) => l.phone)));
const repIds = new Map(reps.map((r) => [r.id, r]));
const branchIds = new Set(branches.map((b) => b.id));
console.log("leads with unknown branch_id:", leads.filter((l) => !branchIds.has(l.branch_id)).length);
console.log("leads with unknown assigned_to:", leads.filter((l) => !repIds.has(l.assigned_to)).length);
console.log("reps with unknown branch_id:", reps.filter((r) => !branchIds.has(r.branch_id)).length);
console.log("targets with unknown branch_id:", targets.filter((t) => !branchIds.has(t.branch_id)).length);
console.log(
  "leads whose rep belongs to a different branch:",
  leads.filter((l) => repIds.get(l.assigned_to)?.branch_id !== l.branch_id).length,
);
console.log("leads assigned to a branch_manager:", leads.filter((l) => repIds.get(l.assigned_to)?.role === "branch_manager").length);
console.log("reps per branch:", countBy(reps, (r) => `${r.branch_id}:${r.role}`));
console.log("reps with zero leads:", reps.filter((r) => !leads.some((l) => l.assigned_to === r.id)).map((r) => `${r.id} (${r.role})`));
console.log("leads per branch:", countBy(leads, (l) => l.branch_id));
console.log("non-positive deal_value:", leads.filter((l) => !(l.deal_value > 0)).length);
console.log(
  "unparseable timestamps:",
  leads.flatMap((l) => [l.created_at, l.last_activity_at, ...l.status_history.map((h) => h.timestamp)]).filter((s) => Number.isNaN(ts(s))).length,
);

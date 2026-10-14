/**
 * Runtime validation of the raw JSON. Fails loudly with a path to the bad
 * value instead of letting a malformed record silently skew a metric.
 */
import {
  LEAD_STATUSES,
  REP_ROLES,
  type LeadStatus,
  type RawBranch,
  type RawDataset,
  type RawDelivery,
  type RawLead,
  type RawSalesRep,
  type RawStatusEvent,
  type RawTarget,
  type RepRole,
} from "@/lib/types";

export class DataValidationError extends Error {
  constructor(path: string, problem: string) {
    super(`Invalid dataset at ${path}: ${problem}`);
    this.name = "DataValidationError";
  }
}

type Obj = Record<string, unknown>;

function obj(value: unknown, path: string): Obj {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DataValidationError(path, "expected an object");
  }
  return value as Obj;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new DataValidationError(path, "expected an array");
  return value;
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new DataValidationError(`${path}.${key}`, "expected a non-empty string");
  }
  return v;
}

function nullableStr(o: Obj, key: string, path: string): string | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    throw new DataValidationError(`${path}.${key}`, "expected a string or null");
  }
  return v;
}

function num(o: Obj, key: string, path: string, { min = -Infinity } = {}): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) {
    throw new DataValidationError(`${path}.${key}`, `expected a finite number ≥ ${min}`);
  }
  return v;
}

function timestamp(o: Obj, key: string, path: string): string {
  const v = str(o, key, path);
  if (Number.isNaN(Date.parse(v))) {
    throw new DataValidationError(`${path}.${key}`, `unparseable date "${v}"`);
  }
  return v;
}

function month(o: Obj, key: string, path: string): string {
  const v = str(o, key, path);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) {
    throw new DataValidationError(`${path}.${key}`, `expected YYYY-MM, got "${v}"`);
  }
  return v;
}

function oneOf<T extends string>(
  o: Obj,
  key: string,
  allowed: readonly T[],
  path: string,
): T {
  const v = str(o, key, path);
  if (!(allowed as readonly string[]).includes(v)) {
    throw new DataValidationError(`${path}.${key}`, `unknown value "${v}"`);
  }
  return v as T;
}

function parseBranch(value: unknown, path: string): RawBranch {
  const o = obj(value, path);
  return { id: str(o, "id", path), name: str(o, "name", path), city: str(o, "city", path) };
}

function parseRep(value: unknown, path: string): RawSalesRep {
  const o = obj(value, path);
  return {
    id: str(o, "id", path),
    name: str(o, "name", path),
    branch_id: str(o, "branch_id", path),
    role: oneOf<RepRole>(o, "role", REP_ROLES, path),
    joined: timestamp(o, "joined", path),
  };
}

function parseEvent(value: unknown, path: string): RawStatusEvent {
  const o = obj(value, path);
  return {
    status: oneOf<LeadStatus>(o, "status", LEAD_STATUSES, path),
    timestamp: timestamp(o, "timestamp", path),
    note: nullableStr(o, "note", path) ?? "",
  };
}

function parseLead(value: unknown, path: string): RawLead {
  const o = obj(value, path);
  const history = arr(o.status_history, `${path}.status_history`).map((e, i) =>
    parseEvent(e, `${path}.status_history[${i}]`),
  );
  if (history.length === 0) {
    throw new DataValidationError(`${path}.status_history`, "must have at least one entry");
  }
  for (let i = 1; i < history.length; i++) {
    if (Date.parse(history[i].timestamp) < Date.parse(history[i - 1].timestamp)) {
      throw new DataValidationError(`${path}.status_history[${i}]`, "entries are not in time order");
    }
  }
  return {
    id: str(o, "id", path),
    customer_name: str(o, "customer_name", path),
    phone: str(o, "phone", path),
    source: str(o, "source", path),
    model_interested: str(o, "model_interested", path),
    status: oneOf<LeadStatus>(o, "status", LEAD_STATUSES, path),
    assigned_to: str(o, "assigned_to", path),
    branch_id: str(o, "branch_id", path),
    created_at: timestamp(o, "created_at", path),
    last_activity_at: timestamp(o, "last_activity_at", path),
    status_history: history,
    expected_close_date: timestamp(o, "expected_close_date", path),
    deal_value: num(o, "deal_value", path, { min: 0 }),
    lost_reason: nullableStr(o, "lost_reason", path),
  };
}

function parseTarget(value: unknown, path: string): RawTarget {
  const o = obj(value, path);
  return {
    branch_id: str(o, "branch_id", path),
    month: month(o, "month", path),
    target_units: num(o, "target_units", path, { min: 0 }),
    target_revenue: num(o, "target_revenue", path, { min: 0 }),
  };
}

function parseDelivery(value: unknown, path: string): RawDelivery {
  const o = obj(value, path);
  return {
    lead_id: str(o, "lead_id", path),
    order_date: timestamp(o, "order_date", path),
    delivery_date: timestamp(o, "delivery_date", path),
    days_to_deliver: num(o, "days_to_deliver", path, { min: 0 }),
    delay_reason: nullableStr(o, "delay_reason", path),
  };
}

function assertUnique(ids: string[], path: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new DataValidationError(path, `duplicate id "${id}"`);
    seen.add(id);
  }
}

/** Validate the raw JSON shape and referential integrity. */
export function parseDataset(input: unknown): RawDataset {
  const root = obj(input, "$");
  const meta = obj(root.metadata, "$.metadata");
  const data: RawDataset = {
    metadata: {
      generated_at: str(meta, "generated_at", "$.metadata"),
      description: str(meta, "description", "$.metadata"),
      date_range: str(meta, "date_range", "$.metadata"),
      notes: str(meta, "notes", "$.metadata"),
    },
    branches: arr(root.branches, "$.branches").map((x, i) => parseBranch(x, `$.branches[${i}]`)),
    sales_reps: arr(root.sales_reps, "$.sales_reps").map((x, i) => parseRep(x, `$.sales_reps[${i}]`)),
    leads: arr(root.leads, "$.leads").map((x, i) => parseLead(x, `$.leads[${i}]`)),
    targets: arr(root.targets, "$.targets").map((x, i) => parseTarget(x, `$.targets[${i}]`)),
    deliveries: arr(root.deliveries, "$.deliveries").map((x, i) =>
      parseDelivery(x, `$.deliveries[${i}]`),
    ),
  };

  assertUnique(data.branches.map((b) => b.id), "$.branches");
  assertUnique(data.sales_reps.map((r) => r.id), "$.sales_reps");
  assertUnique(data.leads.map((l) => l.id), "$.leads");
  assertUnique(data.deliveries.map((d) => d.lead_id), "$.deliveries");
  assertUnique(data.targets.map((t) => `${t.branch_id}/${t.month}`), "$.targets");

  const branchIds = new Set(data.branches.map((b) => b.id));
  const reps = new Map(data.sales_reps.map((r) => [r.id, r]));
  const leadIds = new Set(data.leads.map((l) => l.id));

  data.sales_reps.forEach((r, i) => {
    if (!branchIds.has(r.branch_id)) {
      throw new DataValidationError(`$.sales_reps[${i}].branch_id`, `unknown branch "${r.branch_id}"`);
    }
  });
  data.leads.forEach((l, i) => {
    if (!branchIds.has(l.branch_id)) {
      throw new DataValidationError(`$.leads[${i}].branch_id`, `unknown branch "${l.branch_id}"`);
    }
    const rep = reps.get(l.assigned_to);
    if (!rep) {
      throw new DataValidationError(`$.leads[${i}].assigned_to`, `unknown rep "${l.assigned_to}"`);
    }
    if (rep.branch_id !== l.branch_id) {
      throw new DataValidationError(
        `$.leads[${i}].assigned_to`,
        `rep ${rep.id} belongs to ${rep.branch_id}, lead belongs to ${l.branch_id}`,
      );
    }
  });
  data.targets.forEach((t, i) => {
    if (!branchIds.has(t.branch_id)) {
      throw new DataValidationError(`$.targets[${i}].branch_id`, `unknown branch "${t.branch_id}"`);
    }
  });
  data.deliveries.forEach((d, i) => {
    if (!leadIds.has(d.lead_id)) {
      throw new DataValidationError(`$.deliveries[${i}].lead_id`, `unknown lead "${d.lead_id}"`);
    }
  });

  return data;
}

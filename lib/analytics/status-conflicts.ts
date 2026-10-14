/**
 * CRM status conflicts: leads stored as "lost" whose history has no loss
 * event (and no loss reason). Detected once in enrich.ts as
 * `dataQualityIssue === "status_lost_without_event"`; everything else reads it
 * through this module so the rule lives in one place.
 *
 * This is a data-quality finding about the dataset, not a period metric: it is
 * never filtered by the reporting date range.
 */
import { isOpenStage } from "@/lib/analytics/definitions";
import { ratio } from "@/lib/analytics/kpis";
import { formatNumber } from "@/lib/format";
import type { Branch, Lead } from "@/lib/types";

export function isStatusConflict(lead: Lead): boolean {
  return lead.dataQualityIssue === "status_lost_without_event";
}

export type StatusConflictBranch = {
  branch: Branch;
  /** Leads in this scope and branch stored as lost with no loss event. */
  conflicts: number;
  /** Open leads by history in this scope and branch (conflicts included). */
  openLeads: number;
  /** conflicts ÷ openLeads. */
  share: number | null;
  /** Every open lead here is a status conflict. */
  allOpenAreConflicts: boolean;
};

export type StatusConflictSummary = {
  /** Leads with a conflict in the scope. */
  count: number;
  leadIds: string[];
  /** Open leads by history in the scope (conflicts included). */
  openLeads: number;
  /** Every open lead in the scope is a conflict. */
  allOpenAreConflicts: boolean;
  /** One row per branch given, most conflicts first. */
  byBranch: StatusConflictBranch[];
  /** Branches whose open leads are all conflicts. */
  fullyAffected: StatusConflictBranch[];
  createdFrom: string | null;
  createdTo: string | null;
  maxDaysIdle: number | null;
};

/**
 * Summary for a scope: pass the scope's leads (all leads, a branch's, or an
 * officer's) and the branches to break it down by. Never date-filtered.
 */
export function statusConflictSummary(scopeLeads: Lead[], branches: Branch[]): StatusConflictSummary {
  const conflicts = scopeLeads.filter(isStatusConflict);
  const open = scopeLeads.filter((l) => isOpenStage(l.status));
  const created = conflicts.map((l) => l.createdAt).sort();
  const byBranch = branches
    .map((branch): StatusConflictBranch => {
      const inBranch = (l: Lead) => l.branchId === branch.id;
      const c = conflicts.filter(inBranch).length;
      const o = open.filter(inBranch).length;
      return { branch, conflicts: c, openLeads: o, share: ratio(c, o), allOpenAreConflicts: c > 0 && c === o };
    })
    .sort((a, b) => b.conflicts - a.conflicts || a.branch.name.localeCompare(b.branch.name));
  return {
    count: conflicts.length,
    leadIds: conflicts.map((l) => l.id),
    openLeads: open.length,
    allOpenAreConflicts: conflicts.length > 0 && conflicts.length === open.length,
    byBranch,
    fullyAffected: byBranch.filter((b) => b.allOpenAreConflicts),
    createdFrom: created[0] ?? null,
    createdTo: created[created.length - 1] ?? null,
    maxDaysIdle: conflicts.length ? Math.max(...conflicts.map((l) => l.daysIdle)) : null,
  };
}

export type StatusConflictNotice = {
  title: string;
  body: string;
  /** Short follow-up lines, e.g. which branches are fully affected. */
  notes: string[];
};

function leads(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? "lead" : "leads"}`;
}

/**
 * Wording for the data-quality warning. `scopeName` is null for the whole
 * company, otherwise a branch or officer name. null when there is nothing to warn about.
 */
export function statusConflictNotice(
  summary: StatusConflictSummary,
  scopeName: string | null,
): StatusConflictNotice | null {
  if (summary.count === 0) return null;
  const n = summary.count;
  const subject = scopeName ? `${leads(n)} for ${scopeName}` : leads(n);
  const body = `${subject} ${n === 1 ? "is" : "are"} marked as lost without a recorded loss event or loss reason. ${
    n === 1 ? "It is" : "They are"
  } treated as open in analytics to avoid misreporting genuine losses.`;

  const notes: string[] = [];
  if (scopeName === null) {
    for (const b of summary.fullyAffected) {
      notes.push(`All ${formatNumber(b.openLeads)} of ${b.branch.name}'s open leads are affected.`);
    }
  } else if (summary.allOpenAreConflicts) {
    notes.push(
      `All ${formatNumber(summary.openLeads)} of ${scopeName}'s open leads are affected, so treat its in-progress CRM statuses with caution until they are corrected.`,
    );
  } else {
    notes.push(`${formatNumber(n)} of ${formatNumber(summary.openLeads)} open leads are affected.`);
  }
  return { title: `CRM data quality issue — ${leads(n)}`, body, notes };
}

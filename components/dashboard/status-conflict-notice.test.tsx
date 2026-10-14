import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { StatusConflictExplainer } from "@/components/actions/status-conflict-explainer";
import { StatusConflictNotice } from "@/components/dashboard/status-conflict-notice";
import { actionsHref } from "@/lib/action-params";
import { buildDataset } from "@/lib/analytics/enrich";
import { buildOverview } from "@/lib/analytics/overview";
import { statusConflictNotice, statusConflictSummary } from "@/lib/analytics/status-conflicts";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const real = buildDataset(parseDataset(rawJson as unknown));
const ctx = { months: real.months, branchIds: real.branches.map((b) => b.id) };

function overviewNotice(params: Record<string, string>) {
  const filters = parseFilters(params, ctx);
  const overview = buildOverview(real, filters);
  return renderToStaticMarkup(
    <StatusConflictNotice
      notice={statusConflictNotice(overview.statusConflicts, null)}
      href={actionsHref(filters, { reason: "status_conflict" })}
    />,
  );
}

describe("StatusConflictNotice", () => {
  it("renders the Overview warning when conflicts exist", () => {
    const html = overviewNotice({});
    expect(html).toContain("CRM data quality issue — 14 leads");
    expect(html).toContain("treated as open in analytics to avoid misreporting genuine losses");
    expect(html).toContain("All 7 of Lakeside Toyota&#x27;s open leads are affected.");
  });

  it("links to /actions?reason=status_conflict", () => {
    expect(overviewNotice({})).toContain('href="/actions?reason=status_conflict"');
    expect(overviewNotice({})).toContain("Review affected leads");
  });

  it("stays, unchanged, when the date range changes (and keeps the range in its link)", () => {
    const text = (html: string) => html.replace(/href="[^"]*"/g, "");
    expect(text(overviewNotice({ range: "6m" }))).toBe(text(overviewNotice({})));
    expect(text(overviewNotice({ from: "2025-06", to: "2025-06" }))).toBe(text(overviewNotice({})));
    expect(overviewNotice({ range: "6m" })).toContain('href="/actions?range=6m&amp;reason=status_conflict"');
  });

  it("is a labelled region with a heading, its icon hidden from screen readers", () => {
    const html = overviewNotice({});
    const id = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h2 id="${id}"`);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("wraps instead of truncating, and stacks on narrow screens", () => {
    const html = overviewNotice({});
    expect(html).not.toContain("truncate");
    expect(html).toContain("flex-col");
    expect(html).toContain("sm:flex-row");
    expect(html).toContain("text-pretty");
  });

  it("renders nothing without a notice", () => {
    expect(renderToStaticMarkup(<StatusConflictNotice notice={null} href="/actions" />)).toBe("");
  });
});

describe("StatusConflictExplainer", () => {
  const filters = parseFilters({}, ctx);
  const params = { reason: "status_conflict" as const, severity: null, ownerId: null };

  it("explains the inconsistency, the treatment and the review, without claiming the leads are active", () => {
    const html = renderToStaticMarkup(
      <StatusConflictExplainer summary={statusConflictSummary(real.leads, real.branches)} filters={filters} params={params} />,
    );
    expect(html).toContain("About these 14 status conflicts");
    expect(html).toContain("no loss event and no loss reason");
    expect(html).toContain("excluded from genuine losses");
    expect(html).toContain("suggest ongoing conversations, but that has not been verified");
    expect(html).toContain("6 Dec 2025");
    expect(html).toContain("31 Dec 2025");
    expect(html).toContain('href="/actions?branch=B3&amp;reason=status_conflict"');
    expect(html).toContain("All of Lakeside Toyota&#x27;s open leads are affected");
  });

  it("renders nothing when there are no conflicts", () => {
    expect(
      renderToStaticMarkup(<StatusConflictExplainer summary={statusConflictSummary([], [])} filters={filters} params={params} />),
    ).toBe("");
  });
});

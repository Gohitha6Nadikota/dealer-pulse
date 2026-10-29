import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { WhatIfPanel } from "@/components/funnel/what-if-panel";
import { buildDataset } from "@/lib/analytics/enrich";
import { buildFunnelView } from "@/lib/analytics/funnel-view";
import { parseDataset } from "@/lib/analytics/validate";
import { parseFilters } from "@/lib/filters";

const real = buildDataset(parseDataset(rawJson as unknown));
const ctx = { months: real.months, branchIds: real.branches.map((b) => b.id) };
const inputs = (q: Record<string, string>) => buildFunnelView(real, parseFilters({ range: "all", ...q }, ctx)).scenario!;

describe("WhatIfPanel at rest", () => {
  const html = renderToStaticMarkup(<WhatIfPanel inputs={inputs({})} />);

  it("renders a labelled slider per step plus lead volume, all at 0%", () => {
    expect(html.match(/type="range"/g)?.length).toBe(5);
    for (const label of ["New → Contacted", "Contacted → Test drive", "Test drive → Negotiation", "Negotiation → Order placed", "New leads per month"]) {
      expect(html).toContain(label);
    }
    expect(html.match(/value="0"/g)?.length).toBe(5);
    expect(html).toMatch(/<label for="[^"]+"/);
  });

  it("shows today's figures, equal to the outlook, with no deltas", () => {
    expect(html).toContain("43.2%");
    expect(html).toContain("~23.3");
    expect(html).not.toContain(" pts");
    expect(html).not.toContain("with the changes");
  });

  it("offers 'match best branch' at company scope, and the conflicts toggle", () => {
    expect(html).toContain("Match best branch");
    expect(html).not.toContain("Match company rates");
    expect(html).toContain("Include the 14 open leads stored as lost");
    expect(html).toMatch(/Reset to today/);
  });

  it("offers 'match company rates' on a branch", () => {
    const lakeside = renderToStaticMarkup(<WhatIfPanel inputs={inputs({ branch: "B3" })} />);
    expect(lakeside).toContain("Match company rates");
    expect(lakeside).toContain("15.6%");
    expect(lakeside).toContain("(company rate)");
  });
});

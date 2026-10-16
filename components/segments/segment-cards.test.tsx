import type { ReactElement } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { describe, expect, it } from "vitest";
import rawJson from "@/public/data/dealership_data.json";
import { CarModelsCard, LeadSourcesCard, SegmentCardSkeleton } from "@/components/segments/segment-cards";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildDataset } from "@/lib/analytics/enrich";
import { buildSegments, segments } from "@/lib/analytics/segments";
import { parseDataset } from "@/lib/analytics/validate";

/** Cards use metric tooltips, which need the provider the root layout supplies. */
const renderToStaticMarkup = (el: ReactElement) => render(<TooltipProvider>{el}</TooltipProvider>);

const real = buildDataset(parseDataset(rawJson as unknown));
const ALL = { from: "2025-06", to: "2025-12" };
const scope = { name: "All branches", period: "Jun – Dec 2025" };

describe("LeadSourcesCard", () => {
  const html = renderToStaticMarkup(<LeadSourcesCard segments={buildSegments(real, ALL, null)} scope={scope} />);

  it("renders the legend with each source's count and win rate", () => {
    expect(html).toContain("Walk in");
    expect(html).toMatch(/140<\/span> leads · 62% win/);
    expect(html).toMatch(/72<\/span> leads · 19% win/);
    expect(html).toContain("View as table");
  });

  it("shows the field-reliability caveat, not the 'no difference' line, for this data", () => {
    expect(html).toContain("matches the channel in the lead&#x27;s first note for 16% of leads");
    expect(html).not.toContain("doesn&#x27;t predict conversion");
  });

  it("shows the 'no difference' line when source win rates are close", () => {
    const flat = { ...buildSegments(real, ALL, null), sourcesLookAlike: true };
    expect(renderToStaticMarkup(<LeadSourcesCard segments={flat} scope={scope} />)).toContain(
      "Source doesn&#x27;t predict conversion here",
    );
  });

  it("flags small samples (a branch scope)", () => {
    const lakeside = renderToStaticMarkup(
      <LeadSourcesCard segments={buildSegments(real, ALL, "B3")} scope={{ name: "Lakeside Toyota", period: "Jun – Dec 2025" }} />,
    );
    expect(lakeside).toContain("Lakeside Toyota · leads created in Jun – Dec 2025");
    expect(lakeside.match(/Fewer than 20/g)?.length).toBe(6);
  });
});

describe("CarModelsCard", () => {
  it("sorts by revenue and flags small samples", () => {
    const html = renderToStaticMarkup(<CarModelsCard segments={buildSegments(real, ALL, null)} scope={scope} />);
    expect(html.indexOf("Fortuner")).toBeLessThan(html.indexOf("Hilux"));
    expect(html.match(/Fewer than 20/g)?.length).toBe(1);
    expect(html).toContain("Share of revenue");
  });
});

describe("empty and loading states", () => {
  const empty = segments([]);
  it("shows an empty state instead of a chart or table", () => {
    for (const html of [
      renderToStaticMarkup(<LeadSourcesCard segments={empty} scope={scope} />),
      renderToStaticMarkup(<CarModelsCard segments={empty} scope={scope} />),
    ]) {
      expect(html).toContain("No leads created in this period");
      expect(html).not.toContain("<table");
      expect(html).not.toContain("recharts");
    }
  });

  it("has a skeleton for each card", () => {
    expect(renderToStaticMarkup(<SegmentCardSkeleton variant="donut" />)).toContain("rounded-full");
    expect(renderToStaticMarkup(<SegmentCardSkeleton variant="table" />)).toContain('aria-hidden="true"');
  });
});

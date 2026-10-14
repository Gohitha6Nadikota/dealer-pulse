import { describe, expect, it } from "vitest";
import { toLeadRow } from "@/lib/analytics/lead-rows";
import { sampleDataset } from "@/lib/analytics/fixtures";
import { bucketCounts, bucketOf, filterLeads, searchLeads, sortLeads } from "@/lib/lead-table";

const rows = sampleDataset().leads.map(toLeadRow);
const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe("toLeadRow", () => {
  it("carries the derived status, bucket, staleness and sanitized last note", () => {
    const l6 = rows.find((r) => r.id === "L6")!;
    expect(l6).toMatchObject({ status: "contacted", bucket: "open", stale: true, dataQualityIssue: "status_lost_without_event" });
    const l1 = rows.find((r) => r.id === "L1")!;
    expect(l1).toMatchObject({ bucket: "delivered", stale: false, delivery: { daysToDeliver: 20, delayReason: "RTO registration delay" } });
    expect(rows.find((r) => r.id === "L8")!.stale).toBe(false);
  });

  it("omits fields the table doesn't need (no phone, no raw stored status)", () => {
    expect(Object.keys(rows[0])).not.toContain("phone");
    expect(Object.keys(rows[0])).not.toContain("storedStatus");
  });
});

describe("buckets", () => {
  it("maps statuses to table buckets", () => {
    expect(bucketOf("negotiation")).toBe("open");
    expect(bucketOf("order_placed")).toBe("awaiting");
    expect(bucketOf("delivered")).toBe("delivered");
    expect(bucketOf("lost")).toBe("lost");
  });
  it("counts each bucket", () => {
    expect(bucketCounts(rows)).toEqual({ all: 8, open: 4, awaiting: 1, delivered: 1, lost: 2 });
  });
});

describe("search and filter", () => {
  it("matches customer, id, model and rep, case-insensitively", () => {
    expect(ids(searchLeads(rows, "customer l7"))).toEqual(["L7"]);
    expect(ids(searchLeads(rows, "l2"))).toEqual(["L2"]);
    expect(searchLeads(rows, "glanza")).toHaveLength(8);
    expect(ids(searchLeads(rows, "rep three"))).toEqual(["L7", "L8"]);
    expect(searchLeads(rows, "   ")).toHaveLength(8);
  });
  it("combines bucket and query", () => {
    expect(ids(filterLeads(rows, { bucket: "open", query: "rep two" })).sort()).toEqual(["L4", "L5", "L6"]);
    expect(filterLeads(rows, { bucket: "lost", query: "nobody" })).toEqual([]);
  });
});

describe("sortLeads", () => {
  it("sorts by deal value", () => {
    expect(ids(sortLeads(rows, "value", "desc")).slice(0, 2)).toEqual(["L4", "L1"]);
  });
  it("sorts by days idle with closed leads always last", () => {
    const desc = ids(sortLeads(rows, "idle", "desc"));
    expect(desc.slice(0, 4)).toEqual(["L4", "L6", "L5", "L8"]);
    const asc = ids(sortLeads(rows, "idle", "asc"));
    expect(asc.slice(0, 4)).toEqual(["L8", "L5", "L6", "L4"]);
  });
  it("sorts by stage with lost lowest", () => {
    const desc = sortLeads(rows, "stage", "desc");
    expect(desc[0].status).toBe("delivered");
    expect(desc.at(-1)?.status).toBe("lost");
  });
  it("does not mutate its input", () => {
    const before = ids(rows);
    sortLeads(rows, "customer", "desc");
    expect(ids(rows)).toEqual(before);
  });
});

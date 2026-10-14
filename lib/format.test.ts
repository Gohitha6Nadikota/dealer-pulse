import { describe, expect, it } from "vitest";
import {
  formatChange,
  formatDate,
  formatDays,
  formatINR,
  formatINRFull,
  formatMonth,
  formatPercent,
  formatRange,
  formatRangeCompact,
  humanize,
} from "@/lib/format";

describe("INR formatting", () => {
  it("uses crore and lakh", () => {
    expect(formatINR(84_000_000)).toBe("₹8.4 Cr");
    expect(formatINR(2_090_000)).toBe("₹20.9 L");
    expect(formatINR(10_000_000)).toBe("₹1 Cr");
    expect(formatINR(1_520_000_000)).toBe("₹152 Cr");
    expect(formatINR(85_000)).toBe("₹85,000");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-2_500_000)).toBe("−₹25 L");
    expect(formatINR(null)).toBe("—");
  });

  it("groups full amounts the Indian way", () => {
    expect(formatINRFull(22_970_000)).toBe("₹2,29,70,000");
  });
});

describe("percent and change", () => {
  it("formats ratios and missing values", () => {
    expect(formatPercent(0.138)).toBe("14%");
    expect(formatPercent(0.1388, 1)).toBe("13.9%");
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(Number.NaN)).toBe("—");
  });

  it("signs changes with a real minus", () => {
    expect(formatChange(0.594)).toBe("+59%");
    expect(formatChange(-0.12)).toBe("−12%");
    expect(formatChange(0.001)).toBe("0%");
    expect(formatChange(null)).toBe("—");
  });
});

describe("days and dates", () => {
  it("formats days", () => {
    expect(formatDays(21.43)).toBe("21.4 days");
    expect(formatDays(22)).toBe("22 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(null)).toBe("—");
  });

  it("formats months and ranges", () => {
    expect(formatMonth("2025-10")).toBe("Oct 2025");
    expect(formatRange({ from: "2025-10", to: "2025-12" })).toBe("Oct – Dec 2025");
    expect(formatRange({ from: "2025-12", to: "2025-12" })).toBe("Dec 2025");
    expect(formatRange({ from: "2025-11", to: "2026-02" })).toBe("Nov 2025 – Feb 2026");
    expect(formatRangeCompact({ from: "2025-07", to: "2025-09" })).toBe("Jul – Sep");
  });

  it("formats dates in UTC so AS_OF stays on 31 Dec", () => {
    expect(formatDate("2025-12-31T19:10:00.000Z")).toBe("31 Dec 2025");
  });

  it("humanizes enum values", () => {
    expect(humanize("test_drive")).toBe("Test drive");
  });
});

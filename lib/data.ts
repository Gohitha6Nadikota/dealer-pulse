/**
 * Server-only data access. The JSON is bundled into the server build via a
 * static import, validated, enriched once per server instance, and only
 * derived results are passed to client components as props.
 */
import "server-only";
import rawJson from "@/public/data/dealership_data.json";
import { buildDataset } from "@/lib/analytics/enrich";
import { parseDataset } from "@/lib/analytics/validate";
import type { Branch, Dataset, Lead, SalesRep } from "@/lib/types";

let dataset: Dataset | undefined;

/** The validated, enriched dataset. Throws DataValidationError if the JSON is malformed. */
export function getDataset(): Dataset {
  dataset ??= buildDataset(parseDataset(rawJson as unknown));
  return dataset;
}

export function getBranch(id: string): Branch | undefined {
  return getDataset().branches.find((b) => b.id === id);
}

export function getRep(id: string): SalesRep | undefined {
  return getDataset().reps.find((r) => r.id === id);
}

export function getLead(id: string): Lead | undefined {
  return getDataset().leads.find((l) => l.id === id);
}

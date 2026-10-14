/**
 * Valid ids for the detail routes, read straight from the dataset so nothing
 * is hard-coded. Used by proxy.ts to return a real 404 status: the pages'
 * own notFound() runs after streaming starts, which would leave a 200.
 */
import raw from "@/public/data/dealership_data.json";

const BRANCH_IDS = new Set(raw.branches.map((b) => b.id));
const OFFICER_IDS = new Set(raw.sales_reps.filter((r) => r.role === "sales_officer").map((r) => r.id));

/**
 * For /branches/:id and /reps/:id, whether the id exists (officers only for
 * /reps). null for any other path.
 */
export function detailRouteExists(pathname: string): boolean | null {
  const match = /^\/(branches|reps)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  const id = decodeURIComponent(match[2]);
  return match[1] === "branches" ? BRANCH_IDS.has(id) : OFFICER_IDS.has(id);
}

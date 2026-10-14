/** Plain-language data caveats for the "Data notes" popover, from audited numbers. */
import { kpis, ratio } from "@/lib/analytics/kpis";
import { formatDate } from "@/lib/format";
import type { Dataset } from "@/lib/types";

/** India Standard Time, UTC+5:30. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type DataNote = { title: string; detail: string };

export function dataNotes(ds: Dataset): DataNote[] {
  const all = kpis(ds.leads, ds.targets, { from: ds.months[0], to: ds.months[ds.months.length - 1] });
  const scale = all.targetUnits ? ratio(all.targetUnits, all.bookedUnits) : null;
  const q = ds.dataQuality;
  const notes: DataNote[] = [];
  if (scale !== null && scale > 2) {
    notes.push({
      title: `Targets are ~${Math.round(scale)}× actual volume`,
      detail: `${all.targetUnits} target units vs ${all.bookedUnits} booked. Attainment is shown, but trend and branch comparison carry more signal.`,
    });
  }
  if (q.statusLostWithoutEvent.length) {
    notes.push({
      title: `${q.statusLostWithoutEvent.length} leads marked lost without a loss event`,
      detail: "Their history shows them still active and they have no loss reason, so they are treated as open.",
    });
  }
  if (q.lossNoteContradictions) {
    notes.push({
      title: `${q.lossNoteContradictions} loss notes contradict the loss reason`,
      detail: "e.g. note names a competitor, reason says “Relocated”. Loss analysis uses the structured reason.",
    });
  }
  if (q.templatedNotes) {
    notes.push({
      title: `${q.templatedNotes} notes had a template bug`,
      detail: "“comparing with {} competitor” is shown as “comparing with a competitor”.",
    });
  }
  const istDate = formatDate(new Date(Date.parse(ds.asOf) + IST_OFFSET_MS).toISOString());
  notes.push({
    title: "Dates and months are in UTC",
    detail:
      istDate === formatDate(ds.asOf)
        ? "Timestamps are stored in UTC and grouped into months in UTC."
        : `Timestamps are stored in UTC and grouped into months in UTC. The latest activity is on ${formatDate(ds.asOf)} UTC, which is already ${istDate} in India.`,
  });
  notes.push({
    title: "Recent delivery times are incomplete",
    detail: "Orders from the last few weeks that haven't been delivered yet aren't in the average, so recent months look faster than they are.",
  });
  return notes;
}

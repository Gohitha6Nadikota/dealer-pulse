"use client";

import { OPEN_DATA_NOTES } from "@/components/app-shell/data-notes";

/** Inline text button that opens the header's Data notes popover. */
export function DataNotesLink({ children = "Data notes" }: { children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_DATA_NOTES))}
      className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

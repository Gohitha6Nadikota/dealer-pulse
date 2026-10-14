import { DatabaseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DataNote } from "@/lib/analytics/data-notes";

export function DataNotes({ notes }: { notes: DataNote[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <DatabaseIcon aria-hidden />
          <span className="hidden sm:inline">Data notes</span>
          <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{notes.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-semibold">About this data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Synthetic dataset. Issues found in the audit and how the dashboard handles them.
        </p>
        <ul className="mt-3 space-y-3">
          {notes.map((note) => (
            <li key={note.title} className="text-sm">
              <p className="font-medium">{note.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{note.detail}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

import { Brand } from "@/components/app-shell/brand";
import { DataNotes } from "@/components/app-shell/data-notes";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NavLinks } from "@/components/app-shell/nav-links";
import type { DataNote } from "@/lib/analytics/data-notes";

/** Sidebar on desktop, drawer below lg; top bar with Data notes. */
export function AppShell({
  notes,
  children,
}: {
  notes: DataNote[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <NavLinks />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <MobileNav />
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <DataNotes notes={notes} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

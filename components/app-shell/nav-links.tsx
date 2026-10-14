"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NAV_ITEMS } from "@/components/app-shell/nav-items";
import { rangeQuery } from "@/lib/filters";
import { cn } from "@/lib/utils";

type Props = { onNavigate?: () => void };

/**
 * Main navigation. Links carry the current date range so switching sections
 * keeps the period; the branch filter is dropped because each section has its own scope.
 */
export function NavLinks(props: Props) {
  return (
    <Suspense fallback={<NavLinksView {...props} query="" />}>
      <NavLinksWithQuery {...props} />
    </Suspense>
  );
}

function NavLinksWithQuery(props: Props) {
  const search = useSearchParams();
  return <NavLinksView {...props} query={rangeQuery(search.toString())} />;
}

function NavLinksView({ onNavigate, query }: Props & { query: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, ready, also = [] }) => {
        const active =
          href === "/" ? pathname === "/" : [href, ...also].some((p) => pathname.startsWith(p));
        const classes = cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        if (!ready) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className={cn(classes, "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground")}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={href}
            href={`${href}${query}`}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={classes}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

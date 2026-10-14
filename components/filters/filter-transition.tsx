"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useTransition } from "react";
import { cn } from "@/lib/utils";

type FilterNavigation = { pending: boolean; navigate: (href: string) => void };

const FilterContext = createContext<FilterNavigation>({ pending: false, navigate: () => {} });

/**
 * Filter changes are URL navigations wrapped in a transition: the current
 * view stays on screen (dimmed) while the server renders the new one.
 */
export function FilterTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  return <FilterContext value={{ pending, navigate }}>{children}</FilterContext>;
}

export function useFilterNavigation() {
  return use(FilterContext);
}

/** Content region that dims and reports busy while filters apply. */
export function PendingRegion({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFilterNavigation();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "opacity-50", className)}>
      {children}
    </div>
  );
}

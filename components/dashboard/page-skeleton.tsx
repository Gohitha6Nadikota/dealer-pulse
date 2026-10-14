import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard page layout so nothing jumps when data arrives. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={label}>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <Skeleton className="h-96 rounded-xl xl:col-span-3" />
        <Skeleton className="h-96 rounded-xl xl:col-span-2" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

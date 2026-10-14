"use client";

import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <AlertTriangleIcon className="size-8 text-critical-foreground" aria-hidden />
      <h1 className="text-lg font-semibold">This view couldn&apos;t load</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong while preparing the numbers. Try again, or reset the filters.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Reset filters</Link>
        </Button>
      </div>
    </div>
  );
}

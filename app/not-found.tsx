import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That page doesn&apos;t exist. If you followed a link to a branch or sales officer, the ID may be
        wrong. Branch managers don&apos;t own leads, so they have no officer page.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Overview</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/branches">All branches</Link>
        </Button>
      </div>
    </div>
  );
}

import { ActivityIcon } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ActivityIcon className="size-4" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">DealerPulse</span>
    </div>
  );
}

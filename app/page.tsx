import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Phase 0 placeholder: proves the build, Tailwind and shadcn/ui work on Vercel.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <Badge variant="secondary" className="w-fit">
        Skeleton deploy
      </Badge>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">DealerPulse</CardTitle>
          <CardDescription>
            Dealership performance dashboard. The data layer and dashboard
            are coming in the next phases.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDataset } from "@/lib/data";

// Placeholder until Phase 2. Reads the dataset on the server to prove the data layer deploys.
export default function Home() {
  const { leads, asOf } = getDataset();
  const asOfLabel = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(asOf));
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
          <p className="text-sm text-muted-foreground">
            {leads.length} leads loaded · Data as of {asOfLabel}
          </p>
        </CardHeader>
      </Card>
    </main>
  );
}

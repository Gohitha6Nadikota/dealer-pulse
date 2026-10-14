import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/dashboard/info-tip";
import { cn } from "@/lib/utils";

/** Card with a title, an optional definition tooltip and an optional action slot. */
export function SectionCard({
  title,
  description,
  help,
  action,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  help?: string;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          {title}
          {help && <InfoTip label={title}>{help}</InfoTip>}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

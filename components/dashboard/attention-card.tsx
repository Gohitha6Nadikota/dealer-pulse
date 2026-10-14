import { ArrowRightIcon, ClockAlertIcon, HandshakeIcon, PhoneCallIcon, TruckIcon } from "lucide-react";
import Link from "next/link";
import { InfoTip } from "@/components/dashboard/info-tip";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { THRESHOLDS } from "@/lib/analytics/definitions";
import type { Attention, AttentionItem, AttentionList } from "@/lib/analytics/scope";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { METRIC_HELP } from "@/lib/metric-help";

type ListSpec = {
  key: "stale" | "stuck" | "negotiations";
  title: string;
  help: string;
  icon: typeof PhoneCallIcon;
  /** Who does what, e.g. "Follow up", phrased for the owner. */
  verb: string;
  days: (n: number) => string;
  empty: string;
};

const LISTS: ListSpec[] = [
  {
    key: "stale",
    title: `Leads idle ${THRESHOLDS.staleLeadDays}+ days`,
    help: METRIC_HELP.staleLeads,
    icon: PhoneCallIcon,
    verb: "Follow up",
    days: (n) => `idle ${n}d`,
    empty: "Every open lead has had activity in the last week.",
  },
  {
    key: "stuck",
    title: `Orders waiting ${THRESHOLDS.stuckOrderDays}+ days`,
    help: METRIC_HELP.stuckOrders,
    icon: TruckIcon,
    verb: "Chase delivery",
    days: (n) => `${n}d since order`,
    empty: "No orders are overdue for delivery.",
  },
  {
    key: "negotiations",
    title: `Negotiations ${THRESHOLDS.stalledNegotiationDays}+ days`,
    help: METRIC_HELP.stalledNegotiations,
    icon: HandshakeIcon,
    verb: "Push to close",
    days: (n) => `${n}d in negotiation`,
    empty: "No negotiations have stalled.",
  },
];

/** "Needs attention": each item says who should do what, today. */
export function AttentionCard({ attention, asOf, href }: { attention: Attention; asOf: string; href: string }) {
  const totalValue = attention.stale.value + attention.stuck.value + attention.negotiations.value;
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClockAlertIcon className="size-4 text-critical-foreground" aria-hidden />
          Needs attention
        </CardTitle>
        <CardDescription>
          As of {formatDate(asOf)} (UTC) · {formatINR(totalValue)} in deals waiting on action. Not affected by the date filter.
        </CardDescription>
        <CardAction>
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Action Center <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-3 md:gap-0 md:divide-x">
        {LISTS.map((spec) => (
          <AttentionColumn key={spec.key} spec={spec} list={attention[spec.key]} />
        ))}
      </CardContent>
      {attention.delayReasons.length > 0 && (
        <CardContent className="border-t pt-4 text-xs text-muted-foreground">
          Most common delivery delays:{" "}
          {attention.delayReasons.map((r, i) => (
            <span key={r.reason}>
              {i > 0 && " · "}
              <span className="text-foreground">{r.reason}</span> ({r.count})
            </span>
          ))}
          . Undelivered orders have no reason recorded yet.
        </CardContent>
      )}
    </Card>
  );
}

function AttentionColumn({ spec, list }: { spec: ListSpec; list: AttentionList }) {
  const Icon = spec.icon;
  return (
    <section aria-label={spec.title} className="flex flex-col gap-3 md:px-5 md:first:pl-0 md:last:pr-0">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {spec.title}
          <InfoTip label={spec.title}>{spec.help}</InfoTip>
        </h3>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {formatNumber(list.count)}
          {list.count > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{formatINR(list.value)}</span>
          )}
        </p>
      </div>
      {list.count === 0 ? (
        <p className="text-sm text-muted-foreground">{spec.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.top.map((item) => (
            <AttentionRow key={item.leadId} item={item} spec={spec} />
          ))}
          {list.count > list.top.length && (
            <li className="text-xs text-muted-foreground">
              +{formatNumber(list.count - list.top.length)} more
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function AttentionRow({ item, spec }: { item: AttentionItem; spec: ListSpec }) {
  const owner = item.owner
    ? `${item.owner.name}${item.owner.role === "branch_manager" ? " (manager)" : ""}`
    : item.branchName;
  return (
    <li className="text-sm leading-snug">
      <p className="flex items-baseline justify-between gap-2">
        <span className="truncate font-medium">{item.customer}</span>
        <span className="shrink-0 tabular-nums">{formatINR(item.dealValue)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {item.model} · {spec.days(item.days)} · {item.branchName}
      </p>
      <p className="text-xs">
        <span className="font-medium text-primary">{spec.verb}</span>
        <span className="text-muted-foreground"> — {owner}</span>
      </p>
    </li>
  );
}

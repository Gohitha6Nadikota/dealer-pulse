import { FunnelIcon, HomeIcon, ListChecksIcon, StoreIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other path prefixes that belong to this section (drill-down pages). */
  also?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: HomeIcon },
  { href: "/branches", label: "Branches", icon: StoreIcon, also: ["/reps"] },
  { href: "/funnel", label: "Funnel & outlook", icon: FunnelIcon },
  { href: "/actions", label: "Action Center", icon: ListChecksIcon },
];

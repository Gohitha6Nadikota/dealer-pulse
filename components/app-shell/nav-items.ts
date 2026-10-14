import { HomeIcon, ListChecksIcon, StoreIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
  /** Other path prefixes that belong to this section (drill-down pages). */
  also?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: HomeIcon, ready: true },
  { href: "/branches", label: "Branches", icon: StoreIcon, ready: true, also: ["/reps"] },
  { href: "/actions", label: "Action Center", icon: ListChecksIcon, ready: false },
];

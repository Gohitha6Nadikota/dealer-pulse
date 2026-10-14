import { HomeIcon, ListChecksIcon, StoreIcon, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: HomeIcon, ready: true },
  { href: "/branches", label: "Branches", icon: StoreIcon, ready: false },
  { href: "/actions", label: "Action Center", icon: ListChecksIcon, ready: false },
];

import { PageBreadcrumbs, type Crumb } from "@/components/dashboard/page-breadcrumbs";

/** Breadcrumbs, title, subtitle and the page's filter controls. */
export function PageHeader({
  crumbs,
  title,
  badge,
  subtitle,
  children,
}: {
  crumbs?: Crumb[];
  title: string;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Filter bar. */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {crumbs && <PageBreadcrumbs items={crumbs} />}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

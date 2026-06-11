import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceTone = "default" | "muted" | "accent" | "success" | "warning";

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  size?: "content" | "wide";
}

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceTone;
}

interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

const sizeClassNames = {
  content: "max-w-6xl",
  wide: "max-w-7xl",
};

const toneClassNames: Record<SurfaceTone, string> = {
  default: "app-panel",
  muted: "app-panel app-panel-muted",
  accent: "app-panel app-panel-accent",
  success: "app-panel border-emerald-500/20 bg-emerald-500/8 dark:bg-emerald-500/10",
  warning: "app-panel border-amber-500/20 bg-amber-500/8 dark:bg-amber-500/10",
};

export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(
  function PageShell({ className, size = "content", ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "mx-auto w-full px-4 pb-24 pt-6 sm:px-6 lg:px-8",
          sizeClassNames[size],
          className,
        )}
        {...props}
      />
    );
  },
);

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      {...props}
    >
      <div className="max-w-3xl">
        {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  function Surface({ className, tone = "default", ...props }, ref) {
    return <div ref={ref} className={cn(toneClassNames[tone], className)} {...props} />;
  },
);

export function MetricCard({
  className,
  label,
  value,
  helper,
  ...props
}: MetricCardProps) {
  return (
    <Surface className={cn("flex min-h-[132px] flex-col justify-between p-5", className)} {...props}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div>
        <p className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
          {value}
        </p>
        {helper ? (
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{helper}</div>
        ) : null}
      </div>
    </Surface>
  );
}

export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <Surface
      className={cn(
        "flex flex-col items-center gap-4 border-dashed px-6 py-12 text-center",
        className,
      )}
      tone="muted"
      {...props}
    >
      {icon ? <div className="text-3xl">{icon}</div> : null}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">{title}</h3>
        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      </div>
      {action}
    </Surface>
  );
}

export function StatusPill({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:border-white/10 dark:bg-white/8 dark:text-zinc-200",
        className,
      )}
      {...props}
    />
  );
}

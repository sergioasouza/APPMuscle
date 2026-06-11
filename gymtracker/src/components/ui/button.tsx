import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success";

type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "border border-sky-300/20 bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 text-white shadow-[0_18px_48px_rgba(2,132,199,0.32)] hover:from-blue-600 hover:via-sky-500 hover:to-cyan-400 focus:ring-sky-500/30",
  secondary:
    "border border-slate-200/80 bg-white/90 text-slate-950 shadow-sm hover:border-sky-300 hover:bg-sky-50 dark:border-sky-300/10 dark:bg-sky-400/5 dark:text-white dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10 focus:ring-sky-500/20",
  ghost:
    "bg-transparent text-slate-600 hover:bg-sky-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-sky-400/10 dark:hover:text-white focus:ring-sky-500/20",
  danger:
    "bg-red-500/12 text-red-600 hover:bg-red-500/18 dark:text-red-300 dark:hover:bg-red-500/22 focus:ring-red-500/20",
  success:
    "bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/18 dark:text-emerald-300 dark:hover:bg-emerald-500/22 focus:ring-emerald-500/20",
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-xl px-3.5 py-2 text-sm font-semibold",
  md: "min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold",
  lg: "min-h-12 rounded-2xl px-5 py-3 text-sm font-semibold",
  icon: "h-11 w-11 rounded-2xl p-0",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-normal text-center leading-snug transition-all duration-200 focus:outline-none focus:ring-4 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        variantClassNames[variant],
        sizeClassNames[size],
        className,
      )}
      {...props}
    />
  );
}

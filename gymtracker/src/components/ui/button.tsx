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
    "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-500 text-white shadow-[0_18px_48px_rgba(109,40,217,0.35)] hover:from-violet-500 hover:via-fuchsia-500 hover:to-indigo-400 focus:ring-violet-500/25",
  secondary:
    "border border-zinc-200/80 bg-white/90 text-zinc-900 shadow-sm hover:border-violet-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-violet-500/40 dark:hover:bg-white/10 focus:ring-violet-500/20",
  ghost:
    "bg-transparent text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/8 dark:hover:text-white focus:ring-violet-500/20",
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

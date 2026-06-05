import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const fieldClassName =
  "w-full rounded-2xl border border-zinc-200/80 bg-white/92 px-4 py-3 text-sm text-zinc-950 shadow-sm transition-all duration-200 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-500 [&>option]:bg-white [&>option]:text-zinc-950 dark:[&>option]:bg-zinc-950 dark:[&>option]:text-white";

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClassName, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClassName, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(fieldClassName, "min-h-[132px] resize-none", className)} {...props} />
  );
}

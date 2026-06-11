import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const fieldClassName =
  "w-full rounded-2xl border border-slate-200/80 bg-white/92 px-4 py-3 text-sm text-slate-950 shadow-sm transition-all duration-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-300/10 dark:bg-sky-400/5 dark:text-white dark:placeholder:text-slate-500 [&>option]:bg-white [&>option]:text-slate-950 dark:[&>option]:bg-slate-950 dark:[&>option]:text-white";

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400",
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

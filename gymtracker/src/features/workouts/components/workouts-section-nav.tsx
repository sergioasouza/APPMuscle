"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

function isExercisesPath(pathname: string) {
  return pathname.startsWith("/workouts/exercises");
}

export function WorkoutsSectionNav() {
  const pathname = usePathname();
  const t = useTranslations("Workouts");

  const items = [
    {
      href: "/workouts",
      label: t("sectionWorkouts"),
      active: pathname === "/workouts" || !isExercisesPath(pathname),
    },
    {
      href: "/workouts/exercises",
      label: t("sectionExercises"),
      active: isExercisesPath(pathname),
    },
  ];

    return (
    <nav
      aria-label={t("sectionNavLabel")}
      className="app-panel mb-6 p-1.5"
    >
      <div className="grid grid-cols-2 gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`rounded-2xl px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
              item.active
                ? "bg-gradient-to-r from-blue-700 to-cyan-500 text-white shadow-[0_12px_28px_rgba(2,132,199,0.3)]"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

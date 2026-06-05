export const ANALYTICS_PALETTE_STORAGE_KEY = "gymtracker:analytics-palette";

export const ANALYTICS_PALETTES = [
  {
    id: "highContrast",
    primary: "#f8fafc",
    primaryStrong: "#ffffff",
    primarySoft: "rgba(248, 250, 252, 0.16)",
    secondary: "#38bdf8",
    secondaryStrong: "#7dd3fc",
    secondarySoft: "rgba(56, 189, 248, 0.16)",
    benchmark: "#fbbf24",
    benchmarkSoft: "rgba(251, 191, 36, 0.18)",
    grid: "rgba(226, 232, 240, 0.18)",
    chartSurface: "linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(8, 13, 26, 0.98))",
    glow: "rgba(56, 189, 248, 0.28)",
  },
  {
    id: "electric",
    primary: "#a78bfa",
    primaryStrong: "#c4b5fd",
    primarySoft: "rgba(167, 139, 250, 0.18)",
    secondary: "#34d399",
    secondaryStrong: "#6ee7b7",
    secondarySoft: "rgba(52, 211, 153, 0.16)",
    benchmark: "#f59e0b",
    benchmarkSoft: "rgba(245, 158, 11, 0.18)",
    grid: "rgba(196, 181, 253, 0.18)",
    chartSurface: "linear-gradient(135deg, rgba(30, 20, 62, 0.96), rgba(7, 20, 31, 0.98))",
    glow: "rgba(167, 139, 250, 0.28)",
  },
  {
    id: "solar",
    primary: "#fde047",
    primaryStrong: "#fef08a",
    primarySoft: "rgba(253, 224, 71, 0.18)",
    secondary: "#fb7185",
    secondaryStrong: "#fda4af",
    secondarySoft: "rgba(251, 113, 133, 0.16)",
    benchmark: "#2dd4bf",
    benchmarkSoft: "rgba(45, 212, 191, 0.18)",
    grid: "rgba(254, 240, 138, 0.16)",
    chartSurface: "linear-gradient(135deg, rgba(43, 28, 13, 0.96), rgba(31, 9, 18, 0.98))",
    glow: "rgba(253, 224, 71, 0.25)",
  },
  {
    id: "mono",
    primary: "#e5e7eb",
    primaryStrong: "#ffffff",
    primarySoft: "rgba(229, 231, 235, 0.16)",
    secondary: "#94a3b8",
    secondaryStrong: "#cbd5e1",
    secondarySoft: "rgba(148, 163, 184, 0.16)",
    benchmark: "#facc15",
    benchmarkSoft: "rgba(250, 204, 21, 0.18)",
    grid: "rgba(226, 232, 240, 0.14)",
    chartSurface: "linear-gradient(135deg, rgba(16, 18, 24, 0.98), rgba(3, 7, 18, 0.98))",
    glow: "rgba(226, 232, 240, 0.2)",
  },
] as const;

export type AnalyticsPalette = (typeof ANALYTICS_PALETTES)[number];
export type AnalyticsPaletteId = AnalyticsPalette["id"];

export const DEFAULT_ANALYTICS_PALETTE_ID: AnalyticsPaletteId = "highContrast";

export function getAnalyticsPaletteById(
  paletteId: string | null | undefined,
): AnalyticsPalette {
  return (
    ANALYTICS_PALETTES.find((palette) => palette.id === paletteId) ??
    ANALYTICS_PALETTES[0]
  );
}

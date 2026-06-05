"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ANALYTICS_PALETTE_STORAGE_KEY,
  DEFAULT_ANALYTICS_PALETTE_ID,
  getAnalyticsPaletteById,
  type AnalyticsPaletteId,
} from "@/features/appearance/analytics-palettes";

const paletteChangeEventName = "gymtracker:analytics-palette-change";

function applyPaletteVariables(paletteId: AnalyticsPaletteId) {
  const palette = getAnalyticsPaletteById(paletteId);
  const root = document.documentElement;

  root.style.setProperty("--analytics-primary", palette.primary);
  root.style.setProperty("--analytics-secondary", palette.secondary);
  root.style.setProperty("--analytics-benchmark", palette.benchmark);
}

export function useAnalyticsPalettePreference() {
  const [paletteId, setPaletteIdState] = useState<AnalyticsPaletteId>(
    DEFAULT_ANALYTICS_PALETTE_ID,
  );

  useEffect(() => {
    applyPaletteVariables(paletteId);
  }, [paletteId]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const storedPalette = getAnalyticsPaletteById(
        window.localStorage.getItem(ANALYTICS_PALETTE_STORAGE_KEY),
      );

      setPaletteIdState(storedPalette.id);
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_PALETTE_STORAGE_KEY) {
        return;
      }

      const nextPalette = getAnalyticsPaletteById(event.newValue);
      setPaletteIdState(nextPalette.id);
      applyPaletteVariables(nextPalette.id);
    };

    const handlePaletteChange = (event: Event) => {
      const nextPaletteId =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : null;
      const nextPalette = getAnalyticsPaletteById(nextPaletteId);

      setPaletteIdState(nextPalette.id);
      applyPaletteVariables(nextPalette.id);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(paletteChangeEventName, handlePaletteChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(paletteChangeEventName, handlePaletteChange);
    };
  }, []);

  const setPaletteId = useCallback((nextPaletteId: AnalyticsPaletteId) => {
    const nextPalette = getAnalyticsPaletteById(nextPaletteId);

    setPaletteIdState(nextPalette.id);
    applyPaletteVariables(nextPalette.id);
    window.localStorage.setItem(ANALYTICS_PALETTE_STORAGE_KEY, nextPalette.id);
    window.dispatchEvent(
      new CustomEvent(paletteChangeEventName, { detail: nextPalette.id }),
    );
  }, []);

  return {
    palette: getAnalyticsPaletteById(paletteId),
    paletteId,
    setPaletteId,
  };
}

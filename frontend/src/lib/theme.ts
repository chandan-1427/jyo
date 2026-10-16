import { useEffect } from "react";

const CANVAS = "#0C0E0D";

// Opts the current page into the v2 palette (see index.css). Temporary: once
// every page has been redesigned, v2 becomes the default and this goes.
export function useV2Theme() {
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;

    root.dataset.theme = "v2";
    if (meta) meta.content = CANVAS;

    return () => {
      delete root.dataset.theme;
      if (meta && previous) meta.content = previous;
    };
  }, []);
}

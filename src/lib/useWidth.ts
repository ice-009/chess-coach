import { useEffect, useRef, useState } from 'react';

/** Width of an element in CSS pixels, kept up to date (charts draw at real size so text stays readable). */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // whole pixels, unchanged values skipped, and applied on the next frame so a re-render that resizes the
    // element can't feed back into the observer within one frame (a "ResizeObserver loop" error in WebKit)
    let frame = 0;
    let next = 0;
    const ro = new ResizeObserver(([entry]) => {
      next = Math.max(280, Math.round(entry.contentRect.width));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        setWidth((w) => (w === next ? w : next));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);
  return { ref, width };
}

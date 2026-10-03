import { useLayoutEffect, useRef } from 'react';

/**
 * Publishes how far down the page an element starts as the CSS variable --fit-top, so a board inside it can be
 * sized to fit the rest of the screen (iPad landscape, laptops) instead of running off the bottom.
 */
export function useFitTop<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = '';
    const update = () => {
      const top = `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`;
      if (top !== last) el.style.setProperty('--fit-top', (last = top));
    };
    update();
    // content above can change height after mount (banners, wrapped chips); the body resizing covers all of it
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return ref;
}

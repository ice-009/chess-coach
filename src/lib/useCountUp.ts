import { useEffect, useRef, useState } from 'react';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up from zero the first time its element scrolls into view (ease-out, ~0.8 s).
 * With reduced motion, or once it has run, it is just the value.
 */
export function useCountUp<T extends Element>(value: number, ms = 800) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState<number | null>(() => (reducedMotion() ? null : 0));
  const ran = useRef(false);
  const done = shown === null;
  useEffect(() => {
    const el = ref.current;
    if (ran.current || done || !el) return;
    let raf = 0;
    const run = () => {
      ran.current = true;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        if (k >= 1) return setShown(null); // done: show the live value from now on
        setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      if (ran.current) setShown(null); // interrupted (the value changed): jump to it
    };
  }, [value, ms, done]);
  return [ref, shown ?? value] as const;
}

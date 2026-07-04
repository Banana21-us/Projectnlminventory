"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from its previous value to `target` on change (ease-out cubic). */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  const prevTarget = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    const from = firstRun.current ? 0 : prevTarget.current;
    firstRun.current = false;
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    prevTarget.current = target;
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

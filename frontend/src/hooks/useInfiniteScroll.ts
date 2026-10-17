import { useEffect, useRef } from "react";

/** Returns a ref for a sentinel element; `onVisible` fires whenever it scrolls into view while enabled. */
export function useInfiniteScroll<T extends HTMLElement>(
  onVisible: () => void,
  enabled: boolean,
) {
  const target = useRef<T>(null);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    const element = target.current;
    if (!enabled || !element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) callback.current();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);

  return target;
}

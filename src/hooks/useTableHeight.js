import { useEffect, useState } from 'react';

/**
 * Body height (px) for a virtual table: the viewport minus the chrome above and below it.
 * Virtual tables need a numeric scroll.y. Starts at `min` so the server render and the
 * first client render match, then measures after mount.
 */
export function useTableHeight(offset = 400, min = 360) {
  const [height, setHeight] = useState(min);

  useEffect(() => {
    const measure = () => setHeight(Math.max(min, window.innerHeight - offset));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [offset, min]);

  return height;
}

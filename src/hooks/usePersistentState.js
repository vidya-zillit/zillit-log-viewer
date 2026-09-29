import { useEffect, useRef, useState } from 'react';

/**
 * useState mirrored into localStorage (best effort). The stored value is loaded after
 * mount so the server render and the first client render match (no hydration mismatch).
 */
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored));
    } catch {
      // storage unavailable or corrupt — keep the initial value
    }
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true; // skip the first run so the initial value never overwrites storage
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable (private mode etc.) — keep in memory only
    }
  }, [key, value]);

  return [value, setValue];
}

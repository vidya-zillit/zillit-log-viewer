import { useCallback, useRef, useState } from 'react';
import { fetchLogPage } from '../api/logsApi';
import { normalizeLog, sortLogs } from '../utils/logUtils';

/**
 * Holds the loaded logs and exposes paging operations against the fetchlog API.
 * Every operation throws on failure (AbortError when cancelled) — callers report errors.
 */
export function useLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | loadingAll
  const [progress, setProgress] = useState(null); // { loaded, total } while loading all
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const logsRef = useRef([]);
  const nextSkipRef = useRef(0);
  const abortRef = useRef(null);
  const busyRef = useRef(false);

  const commit = (list) => {
    logsRef.current = list;
    setLogs(list);
  };

  /** Merges raw logs into the current list (deduped by _id). Returns how many were new. */
  const mergeIn = (rawLogs, replace = false) => {
    const map = replace ? new Map() : new Map(logsRef.current.map((l) => [l.id, l]));
    let added = 0;
    for (const raw of rawLogs) {
      const log = normalizeLog(raw);
      if (!map.has(log.id)) added += 1;
      map.set(log.id, log);
    }
    commit(sortLogs([...map.values()]));
    return added;
  };

  const begin = (nextStatus) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    busyRef.current = true;
    setStatus(nextStatus);
    return controller;
  };

  const end = (controller) => {
    if (abortRef.current !== controller) return; // superseded by a newer request
    abortRef.current = null;
    busyRef.current = false;
    setStatus('idle');
    setProgress(null);
  };

  /** Replaces everything with the first page. */
  const fetchFirst = useCallback(async ({ envKey, token, limit }) => {
    const controller = begin('loading');
    try {
      const page = await fetchLogPage({ envKey, token, limit, skip: 0, signal: controller.signal });
      mergeIn(page.logs, true);
      nextSkipRef.current = page.logs.length;
      setTotal(page.total);
      setLastFetchedAt(Date.now());
      return { received: page.logs.length, total: page.total };
    } finally {
      end(controller);
    }
  }, []);

  /** Appends the next page. */
  const loadMore = useCallback(async ({ envKey, token, limit }) => {
    const controller = begin('loading');
    try {
      const page = await fetchLogPage({ envKey, token, limit, skip: nextSkipRef.current, signal: controller.signal });
      const added = mergeIn(page.logs);
      nextSkipRef.current += page.logs.length;
      setTotal(page.total);
      setLastFetchedAt(Date.now());
      return { received: page.logs.length, added };
    } finally {
      end(controller);
    }
  }, []);

  /** Keeps paging until the server total (or maxLogs) is reached. Cancellable. */
  const loadAll = useCallback(async ({ envKey, token, limit, maxLogs = Infinity }) => {
    const controller = begin('loadingAll');
    let stalled = false;
    try {
      setProgress({ loaded: logsRef.current.length, total: null });
      for (;;) {
        const page = await fetchLogPage({ envKey, token, limit, skip: nextSkipRef.current, signal: controller.signal });
        setTotal(page.total);
        if (!page.logs.length) break;
        const added = mergeIn(page.logs);
        nextSkipRef.current += page.logs.length;
        setProgress({ loaded: logsRef.current.length, total: page.total });
        if (added === 0) {
          stalled = true; // server ignored skip — stop instead of looping forever
          break;
        }
        if (nextSkipRef.current >= page.total || logsRef.current.length >= maxLogs) break;
      }
      setLastFetchedAt(Date.now());
      return { loaded: logsRef.current.length, stalled };
    } finally {
      end(controller);
    }
  }, []);

  /** Pulls the newest page and merges anything new (used by auto-refresh). */
  const refreshLatest = useCallback(async ({ envKey, token, limit }) => {
    if (busyRef.current) return { added: 0, skipped: true };
    const page = await fetchLogPage({ envKey, token, limit, skip: 0 });
    const added = mergeIn(page.logs);
    nextSkipRef.current += added; // new rows shift server offsets
    setTotal(page.total);
    setLastFetchedAt(Date.now());
    return { added };
  }, []);

  /** Replaces the list with logs from a saved response / JSON file. */
  const importRaw = useCallback((rawLogs) => {
    abortRef.current?.abort();
    mergeIn(rawLogs, true);
    nextSkipRef.current = 0;
    setTotal(rawLogs.length);
    setLastFetchedAt(Date.now());
    return logsRef.current.length;
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    commit([]);
    nextSkipRef.current = 0;
    setTotal(null);
    setLastFetchedAt(null);
  }, []);

  return { logs, total, status, progress, lastFetchedAt, fetchFirst, loadMore, loadAll, refreshLatest, importRaw, cancel, clear };
}

import { useCallback, useRef, useState } from 'react';
import { fetchLogPage } from '../api/logsApi';
import { normalizeLog, sortLogs } from '../utils/logUtils';
import { MAX_LIMIT, resolveServerQuery } from '../config/serverQuery';

/**
 * Holds the loaded logs and exposes paging operations against the fetchlog API.
 * Every operation throws on failure (AbortError when cancelled) — callers report errors.
 *
 * fetchFirst resolves the server query once and every later page (load more, load all,
 * auto-refresh) reuses it, so skip offsets always walk the same result set.
 */
export function useLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | loadingAll
  const [progress, setProgress] = useState(null); // { loaded, total } while loading all
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [applied, setApplied] = useState(null); // { draft, params, live } behind the loaded logs

  const logsRef = useRef([]);
  const nextSkipRef = useRef(0);
  const abortRef = useRef(null);
  const busyRef = useRef(false);
  const appliedRef = useRef(null);

  const setAppliedQuery = (value) => {
    appliedRef.current = value;
    setApplied(value);
  };
  const appliedParams = () => appliedRef.current?.params ?? {};

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

  /** Replaces everything with the first page of `query` (a server-query draft). */
  const fetchFirst = useCallback(async ({ envKey, token, limit, query }) => {
    const controller = begin('loading');
    try {
      const resolved = resolveServerQuery(query);
      const page = await fetchLogPage({ envKey, token, limit, skip: 0, query: resolved.params, signal: controller.signal });
      setAppliedQuery({ draft: query, ...resolved });
      mergeIn(page.logs, true);
      nextSkipRef.current = page.logs.length;
      setTotal(page.total);
      setLastFetchedAt(Date.now());
      return { received: page.logs.length, total: page.total };
    } finally {
      end(controller);
    }
  }, []);

  /**
   * Replaces everything with every log matching `query`, paging at the API maximum until the
   * server total (or `maxLogs`) is reached. Used for date ranges, where a single page would
   * only cover the newest slice of the range. The list is committed at most once a second, so
   * a long load doesn't re-filter everything on every page. If the load is cancelled or fails,
   * what arrived is kept and Load more continues from there.
   */
  const fetchAll = useCallback(async ({ envKey, token, query, maxLogs = Infinity }) => {
    const controller = begin('loadingAll');
    const resolved = resolveServerQuery(query);
    const map = new Map();
    let started = false; // the first page arrived, so the list now belongs to this query
    let unflushed = false;
    let flushedAt = 0;
    let skip = 0;
    let serverTotal = 0;
    let requests = 0;
    let stalled = false;

    const flush = () => {
      commit(sortLogs([...map.values()]));
      unflushed = false;
      flushedAt = Date.now();
    };

    try {
      setProgress({ loaded: 0, total: null });
      for (;;) {
        const page = await fetchLogPage({ envKey, token, limit: MAX_LIMIT, skip, query: resolved.params, signal: controller.signal });
        requests += 1;
        serverTotal = page.total;
        let added = 0;
        for (const raw of page.logs) {
          const log = normalizeLog(raw);
          if (!map.has(log.id)) added += 1;
          map.set(log.id, log);
        }
        if (!started) {
          started = true;
          setAppliedQuery({ draft: query, ...resolved });
          flush(); // show the newest page straight away
        } else if (page.logs.length && added === 0) {
          stalled = true; // server ignored skip — stop instead of looping forever
          break;
        } else {
          unflushed = true;
        }
        skip += page.logs.length;
        nextSkipRef.current = skip;
        setTotal(page.total);
        setProgress({ loaded: map.size, total: page.total });
        if (!page.logs.length || skip >= page.total || map.size >= maxLogs) break;
        if (Date.now() - flushedAt > 1000) flush();
      }
      setLastFetchedAt(Date.now());
      return { loaded: map.size, total: serverTotal, requests, stalled, capped: map.size >= maxLogs && skip < serverTotal };
    } finally {
      // Keep partial results, unless a newer request has replaced this one.
      if (unflushed && abortRef.current === controller) flush();
      end(controller);
    }
  }, []);

  /** Appends the next page. */
  const loadMore = useCallback(async ({ envKey, token, limit }) => {
    const controller = begin('loading');
    try {
      const page = await fetchLogPage({ envKey, token, limit, skip: nextSkipRef.current, query: appliedParams(), signal: controller.signal });
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
        const page = await fetchLogPage({ envKey, token, limit, skip: nextSkipRef.current, query: appliedParams(), signal: controller.signal });
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

  /**
   * Pulls the newest page and merges anything new (used by auto-refresh). For a relative
   * range ("Last 24 hours") the end moves up to now so new logs arrive; they land on top,
   * which shifts later offsets by `added` exactly as without a query.
   */
  const refreshLatest = useCallback(async ({ envKey, token, limit }) => {
    if (busyRef.current) return { added: 0, skipped: true };
    const current = appliedRef.current;
    if (current?.live) appliedRef.current = { ...current, params: { ...current.params, endDate: new Date().toISOString() } };
    const page = await fetchLogPage({ envKey, token, limit, skip: 0, query: appliedParams() });
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
    setAppliedQuery(null);
    nextSkipRef.current = 0;
    setTotal(rawLogs.length);
    setLastFetchedAt(Date.now());
    return logsRef.current.length;
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    commit([]);
    setAppliedQuery(null);
    nextSkipRef.current = 0;
    setTotal(null);
    setLastFetchedAt(null);
  }, []);

  return { logs, total, status, progress, lastFetchedAt, applied, fetchFirst, fetchAll, loadMore, loadAll, refreshLatest, importRaw, cancel, clear };
}

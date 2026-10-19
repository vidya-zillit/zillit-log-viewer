// Server-side query for the LCW fetchlog API. Shared by the client (to build requests)
// and /api/logs (to whitelist what it forwards). Exact-match fields filter on meta.*;
// startDate/endDate filter on createdAt (when the server received the log), both inclusive.

/** Exact-match params. `logKey` is the matching field on a normalised log (for suggestions). */
export const SERVER_FIELDS = [
  { key: 'platform', label: 'Platform', logKey: 'platform' },
  { key: 'category', label: 'Category', logKey: 'category' },
  { key: 'name', label: 'Event name', logKey: 'name' },
  { key: 'app_version', label: 'App version', logKey: 'appVersion' },
  { key: 'api_status', label: 'Status code', logKey: 'apiStatus' },
  { key: 'user_id', label: 'User ID', logKey: 'userId' },
  { key: 'device_id', label: 'Device ID', logKey: 'deviceId' },
  { key: 'project_id', label: 'Project ID', logKey: 'projectId' },
  { key: 'install_id', label: 'Install ID', logKey: 'installId' },
  { key: 'unique_id', label: 'Log unique_id', logKey: 'uniqueId' },
];

/** Every query param /api/logs forwards upstream besides limit and skip. */
export const SERVER_PARAM_KEYS = [...SERVER_FIELDS.map((f) => f.key), 'has_error', 'search', 'startDate', 'endDate'];

/**
 * Upstream maximum page size. Checked against lcwapi-dev (2026-10-19): a missing limit, 0 or -1
 * all mean 100, and anything above 1000 is cut to 1000 — so a date range always needs paging.
 */
export const MAX_LIMIT = 1000;

/**
 * A date-range fetch loads every matching log rather than one page, but stops here: each
 * loaded log stays in browser memory, and a long range on prod can match far more.
 */
export const RANGE_LOAD_CAP = 25_000;

const HOUR = 3_600_000;
export const TIME_PRESETS = [
  { key: 'any', label: 'Any time' },
  { key: '1h', label: 'Last 1 hour', ms: HOUR },
  { key: '24h', label: 'Last 24 hours', ms: 24 * HOUR },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * HOUR },
  { key: '30d', label: 'Last 30 days', ms: 30 * 24 * HOUR },
  { key: 'custom', label: 'Custom range' },
];

/** What the user is editing. It only takes effect when they fetch. */
export const createEmptyServerQuery = () => ({
  time: 'any',
  range: null, // [fromMs | null, toMs | null] when time === 'custom'
  hasError: '', // '' | 'true' | 'false'
  search: '',
  fields: {}, // { [paramKey]: string }
});

const iso = (ms) => new Date(ms).toISOString();

/**
 * Turns the draft into concrete request params, with relative ranges ("Last 30 days")
 * pinned to `now`. `live` marks a relative range: auto-refresh moves its end up to the
 * current time so new logs keep arriving, while the start stays fixed.
 */
export function resolveServerQuery(draft, now = Date.now()) {
  const params = {};
  for (const { key } of SERVER_FIELDS) {
    const value = (draft.fields[key] ?? '').trim();
    if (value) params[key] = value;
  }
  const search = draft.search.trim();
  if (search) params.search = search; // the API lets search override has_error
  else if (draft.hasError) params.has_error = draft.hasError;

  const preset = TIME_PRESETS.find((p) => p.key === draft.time);
  let live = false;
  if (preset?.ms) {
    params.startDate = iso(now - preset.ms);
    params.endDate = iso(now);
    live = true;
  } else if (draft.time === 'custom' && draft.range) {
    const [from, to] = draft.range;
    if (from !== null) params.startDate = iso(from);
    if (to !== null) params.endDate = iso(to);
  }
  return { params, live };
}

/** Number of active conditions (a date range counts once). */
export function countServerQuery(draft) {
  const { params } = resolveServerQuery(draft);
  return Object.keys(params).filter((k) => k !== 'endDate' || !params.startDate).length;
}

/** Stable key for comparing drafts, so blank fields and whitespace don't count as changes. */
export const serverQueryKey = (draft) => {
  const { params, live } = resolveServerQuery(draft, 0);
  return JSON.stringify({ ...params, live, time: draft.time });
};

/** Short human summary of a draft, e.g. "Last 30 days · platform=ios". */
export function describeServerQuery(draft) {
  const parts = [];
  const preset = TIME_PRESETS.find((p) => p.key === draft.time);
  if (preset?.ms) parts.push(preset.label);
  const { params } = resolveServerQuery(draft);
  if (draft.time === 'custom' && (params.startDate || params.endDate)) {
    const fmt = (s) => (s ? s.slice(0, 16).replace('T', ' ') : '…');
    parts.push(`${fmt(params.startDate)} → ${fmt(params.endDate)} UTC`);
  }
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'startDate' && k !== 'endDate') parts.push(`${k}=${v}`);
  }
  return parts.join(' · ');
}

/** True when the draft limits by date, which switches Fetch to loading the whole range. */
export function hasTimeRange(draft) {
  const { params } = resolveServerQuery(draft);
  return Boolean(params.startDate || params.endDate);
}

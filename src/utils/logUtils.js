import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(relativeTime);
dayjs.extend(utc);

export const EMPTY = '(empty)';

/* ------------------------------------------------------------------ */
/* Normalising                                                         */
/* ------------------------------------------------------------------ */

const OBJECT_ID_RE = /\b[0-9a-f]{24}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** /v1/projects/6a2b.../users → /v1/projects/:id/users so endpoints group together. */
export const normalizePath = (path) => path.replace(UUID_RE, ':uuid').replace(OBJECT_ID_RE, ':id');

const toMs = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const n = Number(value);
  if (!Number.isNaN(n)) return n;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseUrl = (url) => {
  try {
    const u = new URL(url);
    return { host: u.host, path: u.pathname };
  } catch {
    return { host: '', path: url || '' };
  }
};

const str = (v) => (v === null || v === undefined ? '' : String(v));

/** Flattens one raw log ({ _id, data, meta, createdAt }) into a table-friendly record. */
export function normalizeLog(raw) {
  const data = raw?.data ?? {};
  const meta = raw?.meta ?? {};
  const api = data.api ?? {};
  const error = data.error ?? {};

  const apiUrl = str(api.url ?? meta.api_url);
  const { host, path } = apiUrl ? parseUrl(apiUrl) : { host: '', path: '' };
  const apiMethod = str(api.method ?? meta.api_method);
  const statusRaw = api.status ?? meta.api_status;
  const apiStatus = statusRaw === undefined || statusRaw === null || statusRaw === '' ? null : Number(statusRaw);
  const errorMessage = str(error.message ?? meta.error_message);
  const category = str(data.category ?? meta.category);
  const eventTime = toMs(data.event_time ?? meta.event_time);
  const createdAt = toMs(raw?.createdAt);

  let statusGroup = '';
  if (apiStatus !== null) statusGroup = `${Math.floor(apiStatus / 100)}xx`;
  else if (apiUrl) statusGroup = errorMessage === 'Canceled' ? 'canceled' : 'no response';

  const log = {
    id: raw?._id ?? raw?.unique_id,
    uniqueId: str(raw?.unique_id),
    eventTime,
    createdAt,
    time: eventTime ?? createdAt,
    ingestDelayMs: eventTime !== null && createdAt !== null ? createdAt - eventTime : null,

    platform: str(data.platform ?? meta.platform),
    category,
    name: str(data.name ?? meta.name),
    appVersion: str(data.app_version ?? meta.app_version),
    osVersion: str(data.os_version ?? meta.os_version),
    deviceModel: str(data.device_model ?? meta.device_model),
    network: str(data.network ?? meta.network),
    deviceId: str(data.device_id ?? meta.device_id),
    installId: str(data.install_id ?? meta.install_id),
    projectId: str(data.project_id ?? meta.project_id),
    userId: str(data.user_id ?? meta.user_id),

    apiUrl,
    apiHost: host,
    apiPath: path,
    apiMethod,
    apiStatus,
    statusGroup,
    endpoint: apiUrl ? `${apiMethod} ${normalizePath(path)}`.trim() : '',
    apiRequest: api.request ?? '',
    apiResponse: api.response ?? '',

    errorMessage,
    errorCode: str(error.code ?? meta.error_code),
    context: data.context ?? null,

    fingerprint: str(meta.fingerprint),
    schemaVersion: data.schema_version ?? meta.schema_version,
    normaliserVersion: meta.normaliser_version,
    conformed: meta.conformed,

    raw,
  };

  log.isError = Boolean(errorMessage) || (apiStatus !== null && apiStatus >= 400) || category === 'crash';
  log.searchText = JSON.stringify(raw).toLowerCase();
  return log;
}

export const sortLogs = (logs) => logs.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));

/* ------------------------------------------------------------------ */
/* Facets & filters                                                    */
/* ------------------------------------------------------------------ */

export const FACETS = [
  { key: 'platform', label: 'Platform', group: 'Event' },
  { key: 'category', label: 'Category', group: 'Event' },
  { key: 'name', label: 'Event name', group: 'Event' },
  { key: 'network', label: 'Network', group: 'Event' },

  { key: 'apiHost', label: 'API host', group: 'API' },
  { key: 'endpoint', label: 'Endpoint (ids collapsed)', group: 'API' },
  { key: 'apiMethod', label: 'Method', group: 'API' },
  { key: 'statusGroup', label: 'Status class', group: 'API' },
  { key: 'apiStatus', label: 'Status code', group: 'API' },

  { key: 'errorMessage', label: 'Error message', group: 'Error' },
  { key: 'errorCode', label: 'Error code', group: 'Error' },

  { key: 'appVersion', label: 'App version', group: 'Device' },
  { key: 'deviceModel', label: 'Device model', group: 'Device' },
  { key: 'osVersion', label: 'OS version', group: 'Device' },

  { key: 'projectId', label: 'Project ID', group: 'Identity' },
  { key: 'userId', label: 'User ID', group: 'Identity' },
  { key: 'deviceId', label: 'Device ID', group: 'Identity' },
  { key: 'installId', label: 'Install ID', group: 'Identity' },
];

export const FACET_GROUPS = [...new Set(FACETS.map((f) => f.group))];
export const facetLabel = (key) => FACETS.find((f) => f.key === key)?.label ?? key;

export const facetValue = (log, key) => {
  const v = log[key];
  return v === null || v === undefined || v === '' ? EMPTY : String(v);
};

export const QUICK_FILTERS = [
  { key: 'hasError', label: 'Has error', test: (l) => l.isError },
  { key: 'http4xx5xx', label: 'HTTP ≥ 400', test: (l) => l.apiStatus !== null && l.apiStatus >= 400 },
  { key: 'http5xx', label: 'HTTP 5xx', test: (l) => l.apiStatus !== null && l.apiStatus >= 500 },
  { key: 'noResponse', label: 'No response (network)', test: (l) => l.statusGroup === 'no response' },
  { key: 'crash', label: 'Crashes', test: (l) => l.category === 'crash' },
  { key: 'hideCanceled', label: "Hide 'Canceled'", test: (l) => l.errorMessage !== 'Canceled' },
  { key: 'hasUser', label: 'Has user ID', test: (l) => Boolean(l.userId) },
];

export const createEmptyFilters = () => ({
  search: '',
  exclude: '',
  timeField: 'time',
  range: null, // [fromMs | null, toMs | null]
  quick: [],
  facets: {}, // { [facetKey]: { values: string[], negate: boolean } }
});

const activeFacets = (facets) => Object.entries(facets).filter(([, v]) => v?.values?.length);

const matchesFacet = (log, key, { values, negate }) => {
  const hit = values.includes(facetValue(log, key));
  return negate ? !hit : hit;
};

/** Text search, exclude terms, time range and quick toggles. */
export function applyBaseFilters(logs, filters) {
  const query = filters.search.trim().toLowerCase();
  const excludes = filters.exclude
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const quick = QUICK_FILTERS.filter((q) => filters.quick.includes(q.key));
  const [from, to] = filters.range ?? [null, null];
  const hasRange = from !== null || to !== null;

  return logs.filter((log) => {
    if (query && !log.searchText.includes(query)) return false;
    if (excludes.length && excludes.some((t) => log.searchText.includes(t))) return false;
    if (hasRange) {
      const t = log[filters.timeField];
      if (t === null || t === undefined) return false;
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
    }
    for (const q of quick) if (!q.test(log)) return false;
    return true;
  });
}

export function applyFacetFilters(logs, facets) {
  const active = activeFacets(facets);
  if (!active.length) return logs;
  return logs.filter((log) => active.every(([key, state]) => matchesFacet(log, key, state)));
}

/**
 * Option counts for every facet. Each facet is counted against the logs that
 * pass all *other* facet selections, so counts show what you'd get by adding a value.
 */
export function computeFacetOptions(logs, facets) {
  const active = activeFacets(facets);
  const result = {};
  for (const { key } of FACETS) {
    const others = active.filter(([k]) => k !== key);
    const counts = new Map();
    for (const log of logs) {
      if (others.length && !others.every(([k, s]) => matchesFacet(log, k, s))) continue;
      const v = facetValue(log, key);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    for (const v of facets[key]?.values ?? []) if (!counts.has(v)) counts.set(v, 0);
    result[key] = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  return result;
}

export function countActiveFilters(filters) {
  return (
    (filters.search.trim() ? 1 : 0) +
    (filters.exclude.trim() ? 1 : 0) +
    (filters.range ? 1 : 0) +
    filters.quick.length +
    activeFacets(filters.facets).reduce((n, [, s]) => n + s.values.length, 0)
  );
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

export const GROUP_BYS = [
  { key: 'issue', label: 'Event + error', fields: ['name', 'errorMessage'] },
  { key: 'endpoint', label: 'Endpoint + status', fields: ['endpoint', 'apiStatus'] },
  { key: 'errorMessage', label: 'Error message', fields: ['errorMessage'] },
  { key: 'category', label: 'Category', fields: ['category'] },
  { key: 'user', label: 'User', fields: ['userId'] },
  { key: 'device', label: 'Device', fields: ['deviceModel', 'deviceId'] },
  { key: 'appVersion', label: 'App version', fields: ['platform', 'appVersion'] },
  { key: 'project', label: 'Project', fields: ['projectId'] },
];

export function groupLogs(logs, fields) {
  const groups = new Map();
  for (const log of logs) {
    const values = fields.map((f) => facetValue(log, f));
    const key = values.join('␟');
    let g = groups.get(key);
    if (!g) {
      g = { key, values, count: 0, errorCount: 0, first: null, last: null, sample: log, platforms: new Set(), users: new Set(), devices: new Set() };
      groups.set(key, g);
    }
    g.count += 1;
    if (log.isError) g.errorCount += 1;
    if (log.time !== null) {
      if (g.first === null || log.time < g.first) g.first = log.time;
      if (g.last === null || log.time > g.last) {
        g.last = log.time;
        g.sample = log;
      }
    }
    if (log.platform) g.platforms.add(log.platform);
    if (log.userId) g.users.add(log.userId);
    if (log.deviceId) g.devices.add(log.deviceId);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, platforms: [...g.platforms], userCount: g.users.size, deviceCount: g.devices.size }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const formatTime = (ms, pattern = 'YYYY-MM-DD HH:mm:ss.SSS') => (ms === null || ms === undefined ? '—' : dayjs(ms).format(pattern));
export const formatUtc = (ms) => (ms === null || ms === undefined ? '—' : `${dayjs(ms).utc().format('YYYY-MM-DD HH:mm:ss.SSS')} UTC`);
export const fromNow = (ms) => (ms === null || ms === undefined ? '' : dayjs(ms).fromNow());

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  const sign = ms < 0 ? '-' : '';
  let s = Math.abs(Math.round(ms / 1000));
  if (s < 60) return `${sign}${s}s`;
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return sign + [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

/** Pretty-prints strings that contain JSON (api.response, firebase_parameters, …). */
export function tryParseJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export const PLATFORM_COLORS = { android: 'green', ios: 'blue', web: 'purple' };
export const CATEGORY_COLORS = { api: 'geekblue', call: 'cyan', socket: 'orange', crash: 'red', lifecycle: 'default' };

export function statusColor(status) {
  if (status >= 500) return 'red';
  if (status >= 400) return 'volcano';
  if (status >= 300) return 'gold';
  return 'green';
}

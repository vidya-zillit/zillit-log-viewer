export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Calls this app's backend (/api/logs), which forwards to
 * {LCW base}/api/v2/location/log/fetchlog?limit=&skip=&… for the chosen environment.
 * `query` holds server-side filters (see config/serverQuery.js resolveServerQuery).
 * Response: { status: 1, data: { total, limit, skip, logs: [...] } }
 */
export async function fetchLogPage({ envKey, token, limit, skip, query = {}, signal }) {
  const params = new URLSearchParams({ ...query, env: envKey, limit: String(limit), skip: String(skip) });
  const url = `/api/logs?${params}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body (e.g. gateway HTML error page)
  }

  if (!res.ok) {
    throw new ApiError(body?.message || body?.error || `HTTP ${res.status} ${res.statusText}`, res.status);
  }
  if (!body || body.status !== 1 || !body.data) {
    throw new ApiError(body?.message || 'Unexpected response from log API', res.status);
  }

  const { data } = body;
  return {
    total: Number(data.total ?? 0),
    limit: Number(data.limit ?? limit),
    skip: Number(data.skip ?? skip),
    logs: Array.isArray(data.logs) ? data.logs : [],
  };
}

export function describeError(err) {
  if (err?.status === 401 || err?.status === 403) {
    return `Token rejected (${err.status}: ${err.message}). Tokens are short-lived — paste a fresh one.`;
  }
  if (err instanceof TypeError) {
    return `Network error: ${err.message}. Check your connection.`;
  }
  return err?.message || String(err);
}

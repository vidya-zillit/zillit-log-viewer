import { FETCH_LOG_PATH, getBaseUrl } from '../../../config/environments';
import { SERVER_PARAM_KEYS } from '../../../config/serverQuery';

export const dynamic = 'force-dynamic';

const json = (body, status) => Response.json(body, { status });

/** Returns an error message for a malformed filter value, or null. */
const invalid = (key, value) => {
  if (key === 'api_status' && !/^\d{3}$/.test(value)) return `api_status must be a 3-digit HTTP status, got "${value}"`;
  if (key === 'has_error' && value !== 'true' && value !== 'false') return `has_error must be true or false, got "${value}"`;
  if ((key === 'startDate' || key === 'endDate') && Number.isNaN(Date.parse(value))) return `${key} must be an ISO date, got "${value}"`;
  return null;
};

/**
 * GET /api/logs?env=dev|qa|prod&limit=100&skip=0[&startDate=&endDate=&platform=&user_id=…]
 * Forwards the caller's Authorization header and the whitelisted filters (see
 * config/serverQuery.js) to the LCW fetchlog API and relays the response, so the browser
 * only talks to this app (no CORS, no base URLs in client code).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get('env');
  const baseUrl = getBaseUrl(env);
  if (!baseUrl) return json({ status: 0, message: `Unknown environment "${env}"` }, 400);

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ status: 0, message: 'Missing Authorization header' }, 401);

  // limit/skip are only forwarded when given, so the backend's own defaults apply otherwise.
  // limit is passed through as-is (any integer, e.g. 0 or -1 if the backend treats those as
  // "no limit") — the backend enforces its own maximum.
  const params = new URLSearchParams();
  for (const key of ['limit', 'skip']) {
    const value = searchParams.get(key)?.trim();
    if (!value) continue;
    if (!/^-?\d+$/.test(value)) return json({ status: 0, message: `${key} must be an integer, got "${value}"` }, 400);
    params.set(key, value);
  }
  for (const key of SERVER_PARAM_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (!value) continue;
    const error = invalid(key, value);
    if (error) return json({ status: 0, message: error }, 400);
    params.set(key, value);
  }

  let upstream;
  try {
    upstream = await fetch(`${baseUrl}${FETCH_LOG_PATH}?${params}`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    return json({ status: 0, message: `Could not reach ${baseUrl}: ${err.message}` }, 502);
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}

import { FETCH_LOG_PATH, getBaseUrl } from '../../../config/environments';

export const dynamic = 'force-dynamic';

const json = (body, status) => Response.json(body, { status });

const clampInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
};

/**
 * GET /api/logs?env=dev|qa|prod&limit=100&skip=0
 * Forwards the caller's Authorization header to the LCW fetchlog API and relays the response,
 * so the browser only talks to this app (no CORS, no base URLs in client code).
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get('env');
  const baseUrl = getBaseUrl(env);
  if (!baseUrl) return json({ status: 0, message: `Unknown environment "${env}"` }, 400);

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ status: 0, message: 'Missing Authorization header' }, 401);

  const params = new URLSearchParams({
    limit: String(clampInt(searchParams.get('limit'), 100, 1, 5000)),
    skip: String(clampInt(searchParams.get('skip'), 0, 0, Number.MAX_SAFE_INTEGER)),
  });

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

# Zillit Log Viewer

Next.js (App Router, JavaScript) + Ant Design viewer for the LCW client-log API.
The frontend and a small backend live in the same project:

- **Frontend** (`src/app/page.js` → `src/components/LogViewerApp.jsx`): the log UI.
- **Backend** (`src/app/api/logs/route.js`): `GET /api/logs?env=dev|qa|prod&limit=&skip=` forwards the
  caller's `Authorization` header to `{LCW base}/api/v2/location/log/fetchlog` and relays the response.
  The browser only talks to this app, so there are no CORS problems and no proxy rules to configure.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production build
```

1. Pick **Dev / QA / Prod** in the environment dropdown.
2. Paste the auth token (a raw JWT or a full `Bearer …` value both work). The token is decoded locally
   to show `uid`, `pid` and a live expiry countdown — these tokens only live ~5 minutes.
3. **Fetch latest** loads the newest page. Use **Load more** / **Load all** to page back with `limit` + `skip`,
   or turn on **Auto-refresh** to pull new logs on an interval.

## Configuration

Server-side environment variables (`.env` locally, Project → Settings → Environment Variables on Vercel;
`vercel.env` is ready to import there):

| Key | Default |
|---|---|
| `STG_LCW_BASE_URL` | `https://lcwapi-dev.zillit.com/` |
| `QA_LCW_BASE_URL` | `https://lcwapi-qa.zillit.com/` |
| `PROD_LCW_BASE_URL` | `https://lcwapi.zillit.com/` |

All three are optional — the defaults above are used when a variable is missing.

## Features

- **Filters** (all combine with AND)
  - free-text search across the whole log JSON, plus an "exclude if contains" list
  - time range on event time (device) or received time (server), with presets
  - quick toggles: has error, HTTP ≥ 400, HTTP 5xx, no response (network), crashes, hide `Canceled`, has user ID
  - multi-select facets with live counts and an **is / is not** switch: platform, category, event name, network,
    API host, endpoint (ids collapsed, e.g. `GET /v1/projects/:id/users`), method, status class, status code,
    error message/code, app version, device model, OS version, project/user/device/install ID
  - click any tag or ID in the table to filter on it (Alt+click to exclude)
- **Stats** for the current filter: errors, 4xx, 5xx, no-response, crashes, unique users/devices
- **Grouped** tab: collapse repeated logs by event+error, endpoint+status, error, user, device, app version…
  with counts, first/last seen, and a one-click filter
- **Detail drawer**: every field with copy / include / exclude buttons, pretty-printed request/response/context,
  raw JSON, ↑/↓ (or j/k) to move between logs
- **Import JSON** (a saved fetchlog response or an array of logs) and **Export** the filtered logs
- Light / dark theme

## Structure

```
src/
  app/layout.js            root layout (Ant Design SSR registry)
  app/page.js              server page — resolves environments, renders the client app
  app/api/logs/route.js    backend proxy to the LCW fetchlog API
  config/environments.js   env list + base URL resolution (server)
  api/logsApi.js           browser client for /api/logs + error messages
  hooks/useLogs.js         paging, load-all, auto-refresh, import
  utils/logUtils.js        normalising, facets, filters, grouping, formatting
  utils/jwt.js             token cleanup + decode
  components/              ConnectionBar, FilterPanel, LogTable, GroupedView, LogDetailDrawer, …
```

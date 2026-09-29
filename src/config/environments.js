// Shared environment list. Base URLs are resolved on the server (see getEnvironments)
// so they can be changed per deployment without rebuilding client code.
const ENVIRONMENT_DEFS = [
  { key: 'dev', label: 'Dev', color: 'green', envVar: 'STG_LCW_BASE_URL', fallback: 'https://lcwapi-dev.zillit.com/' },
  { key: 'qa', label: 'QA', color: 'orange', envVar: 'QA_LCW_BASE_URL', fallback: 'https://lcwapi-qa.zillit.com/' },
  { key: 'prod', label: 'Prod', color: 'red', envVar: 'PROD_LCW_BASE_URL', fallback: 'https://lcwapi.zillit.com/' },
];

export const FETCH_LOG_PATH = '/api/v2/location/log/fetchlog';

const trimSlash = (url) => url.replace(/\/+$/, '');

/** Server only: environments with their resolved LCW base URLs. */
export const getEnvironments = () =>
  ENVIRONMENT_DEFS.map(({ key, label, color, envVar, fallback }) => ({
    key,
    label,
    color,
    baseUrl: trimSlash(process.env[envVar] || fallback),
  }));

/** Server only: base URL for one environment key, or null if unknown. */
export const getBaseUrl = (key) => getEnvironments().find((e) => e.key === key)?.baseUrl ?? null;

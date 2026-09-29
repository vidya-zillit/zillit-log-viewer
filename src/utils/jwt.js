/** Accepts a raw token or a pasted "Bearer xxx" / full header value. */
export const cleanToken = (value) =>
  (value || '')
    .trim()
    .replace(/^authorization:\s*/i, '')
    .replace(/^bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '');

export function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const BASE = '/api';
let csrfToken = null;

const entityMap = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#039;': "'", '&#39;': "'" };

export function decodeEntities(value) {
  if (typeof value === 'string') {
    return value.replace(/&(amp|lt|gt|quot|apos|#0?39);/g, (m) => entityMap[m] ?? m);
  }
  if (Array.isArray(value)) return value.map(decodeEntities);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeEntities(v)]));
  }
  return value;
}

export class ApiError extends Error {
  constructor(message, status, errors = {}, extra = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.extra = extra;
  }
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

async function refreshCsrf() {
  const res = await fetch(`${BASE}/csrf`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const json = await res.json();
  csrfToken = json?.data?.csrf_token ?? null;
  return csrfToken;
}

function buildUrl(path, query) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  return url.pathname + url.search;
}

async function send(method, path, { body, form, query } = {}, retried = false) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    if (!csrfToken) await refreshCsrf();
    headers['X-CSRF-Token'] = csrfToken;
  }
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection.', 0);
  }

  let json = null;
  try {
    json = decodeEntities(await res.json());
  } catch {
    json = null;
  }

  if (res.status === 419 && !retried) {
    await refreshCsrf();
    return send(method, path, { body, form, query }, true);
  }

  if (!res.ok || !json?.success) {
    const { success, message, errors, ...extra } = json || {};
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthenticated', { detail: { code: extra.code } }));
    }
    throw new ApiError(message || 'Request failed.', res.status, errors || {}, extra);
  }
  if (json.data && typeof json.data === 'object' && json.data.csrf_token) {
    csrfToken = json.data.csrf_token;
  }
  return json;
}

export const api = {
  get: (path, query) => send('GET', path, { query }).then((r) => r.data),
  post: (path, body) => send('POST', path, { body }),
  put: (path, body) => send('PUT', path, { body }),
  patch: (path, body) => send('PATCH', path, { body }),
  del: (path) => send('DELETE', path),
  upload: (path, form) => send('POST', path, { form }),
  async download(path) {
    const res = await fetch(BASE + path, { credentials: 'same-origin' });
    if (!res.ok) {
      let message = 'Download failed.';
      try {
        message = decodeEntities((await res.json()).message) || message;
      } catch {
        message = 'Download failed.';
      }
      if (res.status === 401) window.dispatchEvent(new CustomEvent('auth:unauthenticated'));
      throw new ApiError(message, res.status);
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="([^"]+)"/.exec(disposition);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? match[1] : 'report';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

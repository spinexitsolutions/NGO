/** Fetch wrapper: JSON, cookies, CSRF double-submit header and typed errors. */
export interface ApiIssue {
  path: string;
  message: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** Field errors as { path: message } for forms. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as ApiIssue[]).filter((d) => d?.path).map((d) => [d.path, d.message]));
  }
}

function csrfToken(): string {
  return document.cookie.match(/(?:^|; )ngo_csrf=([^;]+)/)?.[1] ?? '';
}

async function ensureCsrf() {
  if (!csrfToken()) await fetch('/api/v1/public/site/version', { credentials: 'include' });
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const method = opts.method ?? (opts.body || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    await ensureCsrf();
    headers['X-CSRF-Token'] = decodeURIComponent(csrfToken());
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? `Request failed (${res.status})`, e.details);
  }
  return json as T;
}

/** Shorthand returning `data`. */
export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await api<{ data: T }>(path, { signal })).data;
}
export async function send<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  return (await api<{ data: T }>(path, { method, body: body ?? {} })).data;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Triggers a browser download of an authenticated GET endpoint (CSV, PDF). */
export async function download(path: string, filename: string) {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

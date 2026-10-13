import type { ApiErrorCode, ApiResponse } from '../types/api'
import type { CsrfResponse } from '../types/auth'

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class ApiError extends Error {
  readonly code: ApiErrorCode | string
  readonly status: number
  readonly fields: Record<string, string>
  readonly retryAfter: number | null
  readonly extra: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
    retryAfter: number | null = null,
    extra: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
    this.extra = extra
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  skipUnauthorizedHandler?: boolean
}

let csrfToken: string | null = null
let csrfPromise: Promise<string> | null = null
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function resetCsrfToken(): void {
  csrfToken = null
  csrfPromise = null
}

async function send<T>(path: string, options: RequestOptions, csrf: string | null): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json' })
  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }
  if (csrf !== null) {
    headers.set('X-CSRF-Token', csrf)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Check your connection and try again.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || payload === null || payload.error !== null) {
    const error = payload?.error
    const retryHeader = response.headers.get('Retry-After')
    const { code: _code, message: _message, fields: _fields, debug: _debug, ...extra } = (error ?? {}) as Record<string, unknown>
    throw new ApiError(
      response.status,
      error?.code ?? 'SERVER_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.fields ?? {},
      retryHeader !== null ? Number(retryHeader) : null,
      extra,
    )
  }
  return payload.data
}

export async function getCsrfToken(force = false): Promise<string> {
  if (force) {
    resetCsrfToken()
  }
  if (csrfToken !== null) {
    return csrfToken
  }
  if (csrfPromise === null) {
    csrfPromise = send<CsrfResponse>('/auth/csrf', { method: 'GET' }, null)
      .then((data) => {
        csrfToken = data.csrf_token
        return data.csrf_token
      })
      .finally(() => {
        csrfPromise = null
      })
  }
  return csrfPromise
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const needsCsrf = UNSAFE_METHODS.has(method)
  try {
    const token = needsCsrf ? await getCsrfToken() : null
    return await send<T>(path, options, token)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CSRF_INVALID' && needsCsrf) {
      const fresh = await getCsrfToken(true)
      return send<T>(path, options, fresh)
    }
    if (error instanceof ApiError && error.status === 401 && !options.skipUnauthorizedHandler) {
      resetCsrfToken()
      unauthorizedHandler?.()
    }
    throw error
  }
}

export const api = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => apiRequest<T>(path, { ...options, method: 'DELETE' }),
}

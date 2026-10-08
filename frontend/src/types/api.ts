export interface ApiErrorBody {
  code: string
  message: string
  fields?: Record<string, string>
  debug?: {
    exception: string
    message: string
    file: string
    line: number
  }
}

export interface PaginationMeta {
  page: number
  per_page: number
  total: number
}

export interface ApiSuccess<T> {
  data: T
  error: null
  meta?: PaginationMeta
}

export interface ApiFailure {
  data: null
  error: ApiErrorBody
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'CSRF_INVALID'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'

export interface MessageResponse {
  message: string
}

export interface HealthResponse {
  status: 'ok'
  service: string
}

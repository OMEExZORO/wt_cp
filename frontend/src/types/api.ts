export interface ApiErrorBody {
  code: string
  message: string
  fields?: Record<string, string>
}

export interface ApiSuccess<T> {
  data: T
  error: null
  meta?: Record<string, unknown>
}

export interface ApiFailure {
  data: null
  error: ApiErrorBody
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

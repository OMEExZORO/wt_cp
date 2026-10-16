import { AppError, MethodNotAllowedError, RateLimitError } from './errors.js'
import { ApiResponse } from './response.js'

export class ErrorHandler {
  constructor({ debug, logger }) {
    this.debug = debug
    this.logger = logger
  }

  render(error) {
    if (error instanceof AppError) {
      const response = ApiResponse.error(error.code, error.message, error.status, error.fields, error.extra)
      if (error instanceof RateLimitError) response.setHeader('Retry-After', error.retryAfter)
      if (error instanceof MethodNotAllowedError) response.setHeader('Allow', error.allowed.join(', '))
      return response
    }

    this.logger?.error(error?.message ?? String(error), {
      exception: error?.constructor?.name,
      trace: error?.stack,
    })

    const extra = {}
    if (this.debug) {
      extra.debug = {
        exception: error?.constructor?.name,
        message: error?.message ?? String(error),
      }
    }
    return ApiResponse.error('SERVER_ERROR', 'Something went wrong on our side. Please try again later.', 500, {}, extra)
  }
}

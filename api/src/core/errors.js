export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', status = 500, fields = {}, extra = {}, cause } = {}) {
    super(message, { cause })
    this.name = new.target.name
    this.code = code
    this.status = status
    this.fields = fields
    this.extra = extra
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Please sign in to continue.', fields = {}) {
    super(message, { code: 'UNAUTHENTICATED', status: 401, fields })
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', fields = {}) {
    super(message, { code: 'FORBIDDEN', status: 403, fields })
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'The request could not be understood.', fields = {}) {
    super(message, { code: 'BAD_REQUEST', status: 400, fields })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state of the resource.', fields = {}) {
    super(message, { code: 'CONFLICT', status: 409, fields })
  }
}

export class CsrfError extends AppError {
  constructor(message = 'Your session security token is missing or expired. Please retry.', fields = {}) {
    super(message, { code: 'CSRF_INVALID', status: 419, fields })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.', fields = {}) {
    super(message, { code: 'NOT_FOUND', status: 404, fields })
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'The request is too large.', fields = {}) {
    super(message, { code: 'PAYLOAD_TOO_LARGE', status: 413, fields })
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(allowed) {
    super('This method is not allowed for this resource.', { code: 'METHOD_NOT_ALLOWED', status: 405 })
    this.allowed = allowed
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many attempts. Please wait and try again.', retryAfterSeconds = 60) {
    super(message, { code: 'RATE_LIMITED', status: 429 })
    this.retryAfter = Math.max(1, retryAfterSeconds)
  }
}

export class SlotFullError extends AppError {
  constructor(message = 'This time slot has just been fully booked. Please choose another time.', suggestion = null, slot = null) {
    super(message, {
      code: 'CONFLICT',
      status: 409,
      fields: { slot_id: message },
      extra: { reason: 'SLOT_FULL', suggestion },
    })
    this.suggestion = suggestion
    this.slot = slot
  }

  withSuggestion(suggestion) {
    return new SlotFullError(this.message, suggestion, this.slot)
  }
}

export class ValidationError extends AppError {
  constructor(fields, message = 'Please correct the highlighted fields.', threats = []) {
    super(message, { code: 'VALIDATION_FAILED', status: 422, fields })
    this.threats = threats
  }

  static withField(field, message) {
    return new ValidationError({ [field]: message })
  }
}

export class EncryptionError extends Error {}

export class StorageError extends Error {}

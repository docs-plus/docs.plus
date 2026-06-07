/**
 * Custom error classes for better error handling and HTTP status mapping
 */

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// 400 Bad Request errors
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'BAD_REQUEST', details)
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: any) {
    super(message, 401, 'UNAUTHORIZED', details)
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: any) {
    super(message, 403, 'FORBIDDEN', details)
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: any) {
    super(`${resource} not found`, 404, 'NOT_FOUND', details)
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details)
  }
}

// 413 Payload Too Large
export class PayloadTooLargeError extends AppError {
  constructor(message: string = 'File size exceeds maximum allowed', details?: any) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details)
  }
}

// 415 Unsupported Media Type
export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Invalid file type', details?: any) {
    super(message, 415, 'UNSUPPORTED_MEDIA_TYPE', details)
  }
}

// 422 Unprocessable Entity
export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details)
  }
}

// 429 Too Many Requests
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details)
  }
}

// 500 Internal Server Error
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details)
  }
}

// 503 Service Unavailable
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: any) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details)
  }
}

// Database-specific errors
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', details)
  }
}

// Storage-specific errors
export class StorageError extends AppError {
  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message, statusCode, 'STORAGE_ERROR', details)
  }
}

/**
 * Map Prisma errors to application errors
 */
export const handlePrismaError = (error: any): AppError => {
  // Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference
  if (error.code) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return new ConflictError('A record with this value already exists', {
          field: error.meta?.target,
          prismaCode: error.code
        })

      case 'P2025': // Record not found
        return new NotFoundError('Record', {
          prismaCode: error.code
        })

      case 'P2003': // Foreign key constraint failed
        return new BadRequestError('Related record not found', {
          field: error.meta?.field_name,
          prismaCode: error.code
        })

      case 'P2011': // Null constraint violation
        return new ValidationError('Required field is missing', {
          field: error.meta?.constraint,
          prismaCode: error.code
        })

      case 'P2014': // Invalid ID
        return new ValidationError('Invalid identifier', {
          prismaCode: error.code
        })

      default:
        return new DatabaseError(`Database operation failed: ${error.message}`, {
          prismaCode: error.code
        })
    }
  }

  return new DatabaseError(error.message || 'Unknown database error')
}

/**
 * Check if error is an operational error (safe to send to client)
 */
export const isOperationalError = (error: Error): boolean => {
  return error instanceof AppError
}

/**
 * Get safe error response for client
 */
export const getErrorResponse = (error: Error) => {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && error.details
          ? { details: error.details }
          : {})
      }
    }
  }

  // Don't expose internal error details in production
  return {
    success: false,
    error: {
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    }
  }
}

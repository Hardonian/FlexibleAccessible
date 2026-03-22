export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ApiError extends AppError {
  static badRequest(message: string, details?: unknown) {
    return new ApiError(message, 'BAD_REQUEST', 400, details);
  }
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(message, 'UNAUTHORIZED', 401);
  }
  static forbidden(message = 'Forbidden') {
    return new ApiError(message, 'FORBIDDEN', 403);
  }
  static notFound(message = 'Not found') {
    return new ApiError(message, 'NOT_FOUND', 404);
  }
  static conflict(message: string) {
    return new ApiError(message, 'CONFLICT', 409);
  }
  static quotaExceeded(message = 'Quota exceeded') {
    return new ApiError(message, 'QUOTA_EXCEEDED', 429);
  }
  static internal(message = 'Internal server error') {
    return new ApiError(message, 'INTERNAL_ERROR', 500);
  }
}

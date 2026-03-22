import { NextResponse } from 'next/server';
import { AppError } from '@aros/shared';
import { ZodError } from 'zod';

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.flatten() } },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 }
  );
}

export function withErrorHandler(
  handler: (req: Request, context?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: Request, context?: { params: Record<string, string> }) => {
    try {
      return await handler(req, context);
    } catch (error) {
      return apiError(error);
    }
  };
}

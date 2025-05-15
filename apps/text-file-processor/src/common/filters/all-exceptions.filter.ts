import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as express from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<express.Response>();

    // Handle non-HttpExceptions (unexpected errors)
    if (!(exception instanceof HttpException)) {
      this.logger.error('Unhandled error', exception);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        type: 'Internal Server Error',
        // TODO: hide error details in production
        message:
          exception instanceof Error ? exception.message : 'Unknown error',
      });
    }

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Handle validation errors (typically from class-validator)
    if (
      status === 400 || // HttpStatus.BAD_REQUEST
      status === 422 // HttpStatus.UNPROCESSABLE_ENTITY
    ) {
      const errorResponse =
        typeof exceptionResponse === 'object'
          ? exceptionResponse
          : { message: exceptionResponse };

      // Class-validator errors have a specific format with validation errors
      if ('message' in errorResponse && Array.isArray(errorResponse.message)) {
        this.logger.debug(
          `Validation failed: ${JSON.stringify(errorResponse.message)}`,
        );
        return response.status(status).json({
          type: 'ValidationError',
          message: 'Validation failed',
          errors: errorResponse.message,
        });
      }
    }

    // Handle other HttpExceptions
    this.logger.debug(`Exception: ${exception.message}`);
    return response.status(status).json({
      type: exception.name,
      message:
        typeof exceptionResponse === 'object' && 'message' in exceptionResponse
          ? exceptionResponse.message
          : exception.message,
    });
  }
}

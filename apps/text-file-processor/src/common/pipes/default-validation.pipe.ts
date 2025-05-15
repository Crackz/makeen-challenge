import {
  HttpStatus,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';

export class DefaultValidationPipe extends ValidationPipe {
  constructor(overwriteDefaultOptions: ValidationPipeOptions = {}) {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      ...overwriteDefaultOptions,
    });
  }
}

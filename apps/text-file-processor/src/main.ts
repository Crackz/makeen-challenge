import { NestFactory } from '@nestjs/core';
import serverlessExpress from '@codegenie/serverless-express';
import { Callback, Context, Handler } from 'aws-lambda';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DefaultValidationPipe } from './common/pipes/default-validation.pipe';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

let cachedServer: Handler;

async function bootstrap(): Promise<Handler> {
  // Create the NestJS application
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(new DefaultValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Text File Processor API')
    .setDescription('API for processing and storing text files')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .addTag('text-files', 'Operations related to text file processing')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
): Promise<Handler> => {
  const logger = new Logger('Lambda Handler');

  // Set the AWS request ID in the logs for traceability
  logger.log(`Got a new request with ID: ${context.awsRequestId}`);

  // Initialize the server if not already cached
  if (!cachedServer) {
    logger.log('Initializing server (cold start)');
    cachedServer = await bootstrap();
  }

  // Process the request
  return cachedServer(event, context, callback);
};

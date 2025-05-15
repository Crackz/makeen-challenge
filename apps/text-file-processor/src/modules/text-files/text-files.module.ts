import { Module } from '@nestjs/common';
import { DynamooseModule } from 'nestjs-dynamoose';
import { MemoryStoredFile, NestjsFormDataModule } from 'nestjs-form-data';
import { TextFilesController } from './text-files.controller';
import { TextFilesRepository } from './text-files.repository';
import { TextFilesService } from './text-files.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from 'src/common/env/environment-variables';
import { TEXT_FILES_MODEL_NAME } from './text-files.constants';
import { TextFileSchema } from './schemas/text-file.schema';

@Module({
  // TODO: Use S3 instead of directly uploading to the server
  imports: [
    NestjsFormDataModule.config({
      storage: MemoryStoredFile,
    }),
    DynamooseModule.forFeatureAsync([
      {
        name: TEXT_FILES_MODEL_NAME,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (
          _,
          configService: ConfigService<EnvironmentVariables>,
        ) => ({
          schema: TextFileSchema,
          options: {
            tableName: configService.get('TEXT_FILES_TABLE_NAME'),
          },
        }),
      },
    ]),
  ],
  controllers: [TextFilesController],
  providers: [TextFilesService, TextFilesRepository],
})
export class TextFilesModule {}

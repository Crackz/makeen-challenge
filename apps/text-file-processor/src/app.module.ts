import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamooseModule } from 'nestjs-dynamoose';
import { validateEnvironmentVariables } from './common/env/validation';
import { TextFilesModule } from './modules/text-files/text-files.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironmentVariables,
    }),
    DynamooseModule.forRoot({
      // TODO: Get these data from config service in real application
      // aws: {
      //   accessKeyId: '000000000000',
      //   secretAccessKey: 'test',
      //   region: 'eu-central-1',
      // },
    }),
    TextFilesModule,
  ],
})
export class AppModule {}

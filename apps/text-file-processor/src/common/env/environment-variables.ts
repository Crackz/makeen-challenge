import { IsDefined, IsEnum } from 'class-validator';
import { NodeEnvironment } from '../constants/env.constants';

export class EnvironmentVariables {
  @IsDefined()
  @IsEnum(NodeEnvironment)
  NODE_ENV: typeof NodeEnvironment;

  @IsDefined()
  TEXT_FILES_TABLE_NAME: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  HasMimeType,
  IsFile,
  MaxFileSize,
  MemoryStoredFile,
  MinFileSize,
} from 'nestjs-form-data';

export class TextFileDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @IsFile()
  @MinFileSize(1)
  // 1MB limit (in real scenario, this should be configurable or higher)
  @MaxFileSize(1e6)
  @HasMimeType(['text/plain'], { message: 'File must be a text file' })
  file: MemoryStoredFile;
}

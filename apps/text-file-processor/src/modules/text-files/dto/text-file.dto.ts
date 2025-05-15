import { ApiProperty } from '@nestjs/swagger';
import {
  HasMimeType,
  IsFile,
  MaxFileSize,
  MemoryStoredFile,
} from 'nestjs-form-data';

export class TextFileDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  @IsFile()
  @MaxFileSize(1e6)
  @HasMimeType(['text/plain'], { message: 'File must be a text file' })
  file: MemoryStoredFile;
}

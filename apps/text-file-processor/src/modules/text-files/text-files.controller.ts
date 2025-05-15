import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';

import { FormDataRequest } from 'nestjs-form-data';
import { TextFileDto } from './dto/text-file.dto';
import { TextFilesService } from './text-files.service';

@Controller('text-files')
export class TextFilesController {
  private readonly logger = new Logger(TextFilesController.name);

  constructor(private readonly textFilesService: TextFilesService) {}

  @Post()
  @FormDataRequest()
  @HttpCode(HttpStatus.NO_CONTENT)
  upload(@Body() textFileDto: TextFileDto) {
    this.logger.log(
      'Uploading file: ' + textFileDto.file.mimeType,
      textFileDto.file.extension,
    );

    return this.textFilesService.upload(textFileDto.file.buffer);
  }
}

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';

import { FormDataRequest } from 'nestjs-form-data';
import { TextFileDto } from './dto/text-file.dto';
import { TextFilesService } from './text-files.service';

@ApiTags('text-files')
@Controller('text-files')
export class TextFilesController {
  private readonly logger = new Logger(TextFilesController.name);

  constructor(private readonly textFilesService: TextFilesService) {}

  @Post()
  @FormDataRequest()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Upload and process a text file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Text file to be processed',
    type: TextFileDto,
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API key for authentication',
    required: true,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'File successfully processed and stored',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file format or content',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid API key',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'File too large or empty',
  })
  upload(@Body() textFileDto: TextFileDto) {
    this.logger.log(
      'Uploading file: ' + textFileDto.file.mimeType,
      textFileDto.file.extension,
    );

    return this.textFilesService.upload(textFileDto.file.buffer);
  }
}

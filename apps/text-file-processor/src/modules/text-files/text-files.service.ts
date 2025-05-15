import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Writable } from 'src/common/types/writable.type';
import { TextFile } from './interfaces/text-file.interface';
import { TextFilesRepository } from './text-files.repository';

@Injectable()
export class TextFilesService {
  private readonly logger = new Logger(TextFilesService.name);

  constructor(private readonly textFilesRepo: TextFilesRepository) {}

  /**
   * Process and upload a text file
   * @param fileBuffer The file buffer to process
   * @returns The processed file data
   */
  async upload(fileBuffer: Buffer): Promise<void> {
    const content = fileBuffer.toString('utf-8');

    if (content.length === 0) {
      throw new BadRequestException('File content is empty');
    }

    // Create file metadata
    const creatableTextFile: Writable<TextFile> = {
      content,
      timestamp: new Date().toISOString(),
    };

    // Store in database
    const createdTextFile = await this.textFilesRepo.create(creatableTextFile);
    this.logger.log(`File processed and saved with ID: ${createdTextFile.id}`);
  }
}

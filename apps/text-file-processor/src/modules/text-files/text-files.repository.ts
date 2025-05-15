import { Injectable } from '@nestjs/common';
import { InjectModel, Model } from 'nestjs-dynamoose';
import { BaseRepository } from '../../common/repositories/base.repository';
import { TextFile, TextFileKey } from './interfaces/text-file.interface';
import { TEXT_FILES_MODEL_NAME } from './text-files.constants';

/**
 * Repository for text file operations in DynamoDB
 */
@Injectable()
export class TextFilesRepository extends BaseRepository<TextFile, TextFileKey> {
  /**
   * Constructor for TextFilesRepository
   * @param model The dynamoose model for TextFile
   */
  constructor(
    @InjectModel(TEXT_FILES_MODEL_NAME)
    private model: Model<TextFile, TextFileKey>,
  ) {
    super(model);
  }
}

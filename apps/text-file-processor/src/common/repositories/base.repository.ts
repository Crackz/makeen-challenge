import { Item, Model } from 'nestjs-dynamoose';
import { Writable } from '../types/writable.type';

/**
 * Base repository for DynamoDB operations using nestjs-dynamoose
 * @template T The entity type
 */
export abstract class BaseRepository<T, K> {
  /**
   * Constructor for BaseRepository
   * @param _model The dynamoose model
   */
  constructor(protected readonly _model: Model<T, K>) {}

  /**
   * Save an entity to DynamoDB
   * @param data The entity to save
   * @returns A promise resolving to the saved entity
   */
  async create(data: Writable<T>): Promise<Item<T>> {
    // Todo: enhance the passed type as it would require a thorough explanation on dynamoose types (ignored to save time)
    return await this._model.create(data as any);
  }
}

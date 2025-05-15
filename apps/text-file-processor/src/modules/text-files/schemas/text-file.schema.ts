import { Schema } from 'dynamoose';
import * as crypto from 'crypto';

/**
 * DynamoDB schema for TextFile entity
 */
export const TextFileSchema = new Schema({
  id: {
    type: String,
    hashKey: true,
    default: () => crypto.randomUUID(),
  },
  timestamp: {
    type: String,
    rangeKey: true,
  },
  content: {
    type: String,
    required: true,
  },
});

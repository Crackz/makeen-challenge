import { DeleteCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from './aws-config';
import { TextFile } from 'src/modules/text-files/interfaces/text-file.interface';
import { Item } from 'nestjs-dynamoose';

/**
 * Helper class for interacting with DynamoDB in tests
 */
export class DynamoDBHelper {
  private readonly client = createDynamoDBClient();
  private readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Get an item from DynamoDB by its ID
   * @param id The ID of the item to get
   * @returns The item or undefined if not found
   */
  async getItemById(id: string) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });

    try {
      const response = await this.client.send(command);
      return response.Item;
    } catch (error) {
      console.error('Error getting item from DynamoDB:', error);
      return undefined;
    }
  }

  /**
   * Scan all items in the table
   * @returns Array of items in the table
   */
  async scanAllItems(): Promise<Item<TextFile>[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    try {
      const response = await this.client.send(command);
      return (response.Items as Item<TextFile>[]) || [];
    } catch (error) {
      console.error('Error scanning DynamoDB table:', error);
      return [];
    }
  }

  /**
   * Find items by content (partial match)
   * @param contentPattern The content pattern to search for
   * @returns Array of matching items
   */
  async findItemsByContent(contentPattern: string) {
    // Since DynamoDB doesn't support direct text search, we'll scan and filter
    const allItems = await this.scanAllItems();
    return allItems.filter(
      (item) => item.content && item.content.includes(contentPattern),
    );
  }

  /**
   * Delete all items in the table
   * @returns Number of items deleted
   */
  async deleteAllItems(): Promise<number> {
    const items = await this.scanAllItems();
    // Delete each item one by one
    const deletePromises = items.map(async (item) => {
      // We need both the hash key (id) and range key (timestamp) for deletion
      // since the table has a composite key
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          id: item.id,
          timestamp: item.timestamp,
        },
      });
      try {
        await this.client.send(command);
        return true;
      } catch (error) {
        console.error(`Error deleting item ${item.id}:`, error);
        return false;
      }
    });
    const results = await Promise.all(deletePromises);
    return results.filter(Boolean).length;
  }
}

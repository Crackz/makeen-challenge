import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Creates a DynamoDB document client configured for LocalStack
 * @returns A configured DynamoDB document client
 */
export function createDynamoDBClient() {
  // Use environment variables or default to LocalStack test endpoint
  const LOCALSTACK_TEST_PORT = process.env.LOCALSTACK_TEST_PORT || 4567;
  const DYNAMODB_ENDPOINT = `http://localhost:${LOCALSTACK_TEST_PORT}`;

  // Create the base DynamoDB client with LocalStack configuration
  const client = new DynamoDBClient({
    // TODO: get this from env vars
    endpoint: DYNAMODB_ENDPOINT,
    region: 'eu-central-1', // LocalStack default region
    credentials: {
      accessKeyId: '000000000000',
      secretAccessKey: 'test',
    },
  });

  // Create and return the document client
  return DynamoDBDocumentClient.from(client);
}

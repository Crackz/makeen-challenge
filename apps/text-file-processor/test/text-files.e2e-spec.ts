import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import { join } from 'path';
import { DynamoDBHelper } from './utils/dynamodb-helper';

describe('TextFiles API E2E Tests with LocalStack', () => {
  // LocalStack API endpoint
  const LOCALSTACK_TEST_PORT = 4567;
  const LOCALSTACK_API_BASE_URL = `http://makeen-challenge-api.execute-api.localhost.localstack.cloud:${LOCALSTACK_TEST_PORT}`;
  const LOCALSTACK_API_KEY_VALUE = 'super-secret-dummy-api-key'; // This is the API key used in the test script
  const TEXT_FILES_API_URL = `${LOCALSTACK_API_BASE_URL}/text-files`;
  const TABLE_NAME = 'textFiles';

  // DynamoDB helper for verifying data
  let dynamoDBHelper: DynamoDBHelper;

  // Define search patterns for verifying content in DynamoDB
  const SEARCH_PATTERNS = {
    basic: 'sample test file for E2E testing',
    specialChars: 'Special characters test file',
    multiline: 'Line 1:',
  };

  // Test file paths
  const fixturesDir = join(__dirname, 'fixtures', 'text-files');
  const filePaths = {
    basic: join(fixturesDir, 'test-file.txt'),
    binary: join(fixturesDir, 'binary-file.bin'),
    large: join(fixturesDir, 'large-file.txt'),
    specialChars: join(fixturesDir, 'special-chars-file.txt'),
    multiline: join(fixturesDir, 'multiline-file.txt'),
  };

  // Set up test environment
  beforeAll(() => {
    // Verify that all test files exist
    Object.entries(filePaths).forEach(([key, filePath]) => {
      if (!fs.existsSync(filePath)) {
        throw new Error(
          `Test file not found: ${filePath}. Please ensure all test fixtures are present.`,
        );
      }
      console.log(`Using test file: ${key} at ${filePath}`);
    });

    // Initialize DynamoDB helper
    dynamoDBHelper = new DynamoDBHelper(TABLE_NAME);

    console.log('E2E test environment initialized');
  }, 30000); // Increase timeout for LocalStack initialization

  // Clean up DynamoDB after each test
  afterEach(async () => {
    // Delete all items from the DynamoDB table
    const deletedCount = await dynamoDBHelper.deleteAllItems();
    console.log(`Cleaned up ${deletedCount} items from DynamoDB after test`);
    // Wait a moment to ensure deletion is complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 5000);

  // Test successful file upload
  it('should upload a text file successfully and store in DynamoDB', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePaths.basic));

    // Upload a test file
    const response = await axios.post(TEXT_FILES_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': LOCALSTACK_API_KEY_VALUE,
      },
    });
    expect(response.status).toBe(204);

    // Wait a moment for DynamoDB write to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify the file was stored in DynamoDB
    const items = await dynamoDBHelper.findItemsByContent(
      SEARCH_PATTERNS.basic,
    );
    expect(items.length).toEqual(1);

    // Verify content was stored correctly
    const item = items[0];
    expect(item).toBeDefined();
    expect(item.content).toContain('This is a sample test file');
    expect(item.id).toBeDefined();
    expect(item.timestamp).toBeDefined();
  }, 10000);

  // Test upload without API key (should fail)
  it('should reject requests without a valid API key', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePaths.basic));

    try {
      // Attempt to upload without API key
      await axios.post(TEXT_FILES_API_URL, form, {
        headers: {
          ...form.getHeaders(),
          // No x-api-key header
        },
      });
      fail('Expected request to fail due to missing API key');
    } catch (error) {
      const axiosError = error as AxiosError;
      // The API returns 401 Unauthorized for missing API key
      expect(axiosError.response?.status).toBe(401);
    }
  }, 10000);

  // Test large file upload
  it('should reject files that are too large', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePaths.large));

    try {
      // Attempt to upload a large file
      await axios.post(TEXT_FILES_API_URL, form, {
        headers: {
          ...form.getHeaders(),
          'x-api-key': LOCALSTACK_API_KEY_VALUE,
        },
        // Increase timeout for large file
        timeout: 30000,
      });
      fail('Expected request to fail due to file size limits');
    } catch (error) {
      const axiosError = error as AxiosError;
      // The API returns 422 for files that are too large
      expect(axiosError.response?.status).toBe(422);
    }
  }, 30000);

  // Test file with special characters
  it('should handle files with special characters correctly', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePaths.specialChars));

    const response = await axios.post(TEXT_FILES_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': LOCALSTACK_API_KEY_VALUE,
      },
    });
    expect(response.status).toBe(204);

    // Wait a moment for DynamoDB write to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify the file with special characters was stored correctly
    const items = await dynamoDBHelper.findItemsByContent(
      SEARCH_PATTERNS.specialChars,
    );
    expect(items.length).toEqual(1);
    const specialCharsItem = items[0];
    expect(specialCharsItem).toBeDefined();
    // Check for the presence of special characters in the content
    expect(specialCharsItem.content).toContain('Special characters test file');
    expect(specialCharsItem.content).toContain('!@#$%^&*()_+-={}[]|;');
    expect(specialCharsItem.content).toContain("'");
    expect(specialCharsItem.content).toContain('<>,.?/');
  }, 10000);

  // Test multiline file
  it('should handle multiline files correctly', async () => {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePaths.multiline));

    const response = await axios.post(TEXT_FILES_API_URL, form, {
      headers: {
        ...form.getHeaders(),
        'x-api-key': LOCALSTACK_API_KEY_VALUE,
      },
    });
    expect(response.status).toBe(204);

    // Wait a moment for DynamoDB write to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify the multiline file was stored correctly
    const items = await dynamoDBHelper.findItemsByContent(
      SEARCH_PATTERNS.multiline,
    );
    expect(items.length).toEqual(1);
    const multilineItem = items[0];
    expect(multilineItem).toBeDefined();
    expect(multilineItem.content).toContain('Line 1:');
    expect(multilineItem.content).toContain('Line 2:');
    expect(multilineItem.content).toContain('Line 3:');
    expect(multilineItem.content.split('\n').length).toBeGreaterThanOrEqual(3);
  }, 10000);

  // Test concurrent file uploads
  it('should handle concurrent file uploads correctly', async () => {
    // Create multiple form data objects
    const form1 = new FormData();
    form1.append('file', fs.createReadStream(filePaths.basic));
    const form2 = new FormData();
    form2.append('file', fs.createReadStream(filePaths.multiline));
    const form3 = new FormData();
    form3.append('file', fs.createReadStream(filePaths.specialChars));

    // Upload multiple files concurrently
    const [response1, response2, response3] = await Promise.all([
      axios.post(TEXT_FILES_API_URL, form1, {
        headers: {
          ...form1.getHeaders(),
          'x-api-key': LOCALSTACK_API_KEY_VALUE,
        },
      }),
      axios.post(TEXT_FILES_API_URL, form2, {
        headers: {
          ...form2.getHeaders(),
          'x-api-key': LOCALSTACK_API_KEY_VALUE,
        },
      }),
      axios.post(TEXT_FILES_API_URL, form3, {
        headers: {
          ...form3.getHeaders(),
          'x-api-key': LOCALSTACK_API_KEY_VALUE,
        },
      }),
    ]);

    // Verify all responses are successful
    expect(response1.status).toBe(204);
    expect(response2.status).toBe(204);
    expect(response3.status).toBe(204);

    // Wait a moment for DynamoDB writes to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify all files were stored correctly
    // Get all items and check that we have at least 3 items
    const allItems = await dynamoDBHelper.scanAllItems();
    expect(allItems.length).toBeGreaterThanOrEqual(3); // At least 3 items from our concurrent uploads
  }, 15000);

  // TODO: Handle more edge case like empty files, more files with different magic numbers
});

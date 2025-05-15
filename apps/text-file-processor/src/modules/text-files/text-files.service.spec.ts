/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TextFilesRepository } from './text-files.repository';
import { TextFilesService } from './text-files.service';
import { TextFile } from './interfaces/text-file.interface';
import { Writable } from 'src/common/types/writable.type';

describe('TextFilesService', () => {
  let service: TextFilesService;
  let repository: TextFilesRepository;

  // Mock the TextFilesRepository
  const mockTextFilesRepository = {
    create: jest.fn().mockImplementation((data: Writable<TextFile>) => {
      const textFile: TextFile = {
        id: 'test-id',
        timestamp: data.timestamp,
        content: data.content,
      };
      return Promise.resolve(textFile);
    }),
  };

  // Mock the Logger to prevent console output during tests
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextFilesService,
        {
          provide: TextFilesRepository,
          useValue: mockTextFilesRepository,
        },
      ],
    }).compile();

    service = module.get<TextFilesService>(TextFilesService);
    repository = module.get<TextFilesRepository>(TextFilesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    it('should convert the buffer to a string', async () => {
      // Create a test buffer
      const testBuffer = Buffer.from('test content');

      // Call the service method
      await service.upload(testBuffer);

      // Verify the repository was called with the correct content
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'test content',
        }),
      );
    });

    it('should add a timestamp to the created text file', async () => {
      // Mock Date.now to return a consistent timestamp
      const mockDate = new Date('2025-01-01T00:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Create a test buffer
      const testBuffer = Buffer.from('test content');

      // Call the service method
      await service.upload(testBuffer);

      // Verify the repository was called with a timestamp
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: mockDate.toISOString(),
        }),
      );
    });

    it('should throw BadRequestException for empty content', async () => {
      // Create an empty buffer
      const emptyBuffer = Buffer.from('');

      // Call the service method and expect it to throw
      await expect(service.upload(emptyBuffer)).rejects.toThrow(
        'File content is empty',
      );

      // Verify the repository was not called
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should propagate errors from the repository', async () => {
      // Mock the repository to throw an error
      mockTextFilesRepository.create.mockRejectedValueOnce(
        new Error('Database error'),
      );

      // Create a test buffer
      const testBuffer = Buffer.from('test content');

      // Call the service method and expect it to throw
      await expect(service.upload(testBuffer)).rejects.toThrow(
        'Database error',
      );
    });
  });
});

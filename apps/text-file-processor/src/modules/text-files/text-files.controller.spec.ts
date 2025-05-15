/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MemoryStoredFile, NestjsFormDataModule } from 'nestjs-form-data';
import { TextFileDto } from './dto/text-file.dto';
import { TextFilesController } from './text-files.controller';
import { TextFilesService } from './text-files.service';

describe('TextFilesController', () => {
  let controller: TextFilesController;
  let service: TextFilesService;

  // Mock the TextFilesService
  const mockTextFilesService = {
    upload: jest.fn().mockImplementation(() => Promise.resolve()),
  };

  // Mock the Logger to prevent console output during tests
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestjsFormDataModule.config({
          storage: MemoryStoredFile,
        }),
      ],
      controllers: [TextFilesController],
      providers: [
        {
          provide: TextFilesService,
          useValue: mockTextFilesService,
        },
      ],
    }).compile();

    controller = module.get<TextFilesController>(TextFilesController);
    service = module.get<TextFilesService>(TextFilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should call the service with the file buffer', async () => {
      // Create a mock file
      const mockFile = {
        buffer: Buffer.from('test file content'),
        originalName: 'test.txt',
        mimeType: 'text/plain',
        extension: 'txt',
        size: 17,
      } as MemoryStoredFile;

      // Create a mock DTO
      const dto: TextFileDto = {
        file: mockFile,
      };

      // Call the controller method
      await controller.upload(dto);

      // Verify the service was called with the correct buffer
      expect(service.upload).toHaveBeenCalledWith(mockFile.buffer);
      expect(service.upload).toHaveBeenCalledTimes(1);
    });

    it('should return the result from the service', async () => {
      // Create a mock file
      const mockFile = {
        buffer: Buffer.from('test file content'),
        originalName: 'test.txt',
        mimeType: 'text/plain',
        extension: 'txt',
        size: 17,
      } as MemoryStoredFile;

      // Create a mock DTO
      const dto: TextFileDto = {
        file: mockFile,
      };

      // Call the controller method
      const result = await controller.upload(dto);

      // Verify the result is what the service returned
      expect(result).toBeUndefined(); // Since the service returns void
    });
  });
});

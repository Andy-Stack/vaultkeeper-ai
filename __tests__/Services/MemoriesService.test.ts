import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoriesService } from '../../Services/MemoriesService';
import { RegisterSingleton, DeregisterAllServices } from '../../Services/DependencyService';
import { Services } from '../../Services/Services';
import { Copy } from '../../Enums/Copy';

describe('MemoriesService', () => {
    let service: MemoriesService;
    let mockFileSystemService: any;
    let mockWorkSpaceService: any;

    beforeEach(() => {
        mockFileSystemService = {
            exists: vi.fn(),
            readFilePath: vi.fn(),
            writeToFilePath: vi.fn()
        };
        mockWorkSpaceService = {
            openNoteByPath: vi.fn()
        };
        RegisterSingleton(Services.FileSystemService, mockFileSystemService);
        RegisterSingleton(Services.WorkSpaceService, mockWorkSpaceService);
        service = new MemoriesService();
    });

    afterEach(() => {
        DeregisterAllServices();
        vi.restoreAllMocks();
    });

    describe('readMemories', () => {
        it('should return file contents when file exists', async () => {
            mockFileSystemService.readFilePath.mockResolvedValue('Remember: user prefers TypeScript.');

            const result = await service.readMemories();

            expect(result).toBe('Remember: user prefers TypeScript.');
        });

        it('should return MemoriesEmpty copy when file does not exist', async () => {
            mockFileSystemService.readFilePath.mockResolvedValue(new Error('File not found'));

            const result = await service.readMemories();

            expect(result).toBe(Copy.MemoriesEmpty);
        });

        it('should return MemoriesEmpty copy when read returns any error', async () => {
            mockFileSystemService.readFilePath.mockResolvedValue(new Error('Permission denied'));

            const result = await service.readMemories();

            expect(result).toBe(Copy.MemoriesEmpty);
        });
    });

    describe('updateMemories', () => {
        it('should write memories and return success message', async () => {
            mockFileSystemService.writeToFilePath.mockResolvedValue(undefined);

            const result = await service.updateMemories('Line one\nLine two');

            expect(mockFileSystemService.writeToFilePath).toHaveBeenCalledOnce();
            expect(result).toBe(Copy.MemoriesUpdatedSuccess);
        });

        it('should write empty memories successfully', async () => {
            mockFileSystemService.writeToFilePath.mockResolvedValue(undefined);

            const result = await service.updateMemories('');

            expect(result).toBe(Copy.MemoriesUpdatedSuccess);
        });

        it('should return error when write fails', async () => {
            const writeError = new Error('Disk full');
            mockFileSystemService.writeToFilePath.mockResolvedValue(writeError);

            const result = await service.updateMemories('some content');

            expect(result).toBe(writeError);
        });

        it('should reject memories exceeding 10 lines', async () => {
            const elevenLines = Array(11).fill('a').join('\n');

            const result = await service.updateMemories(elevenLines);

            expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
            expect(result).toBeTypeOf('string');
            expect(result as string).toContain('10');
        });

        it('should accept exactly 10 lines', async () => {
            mockFileSystemService.writeToFilePath.mockResolvedValue(undefined);
            const tenLines = Array(10).fill('valid line').join('\n');

            const result = await service.updateMemories(tenLines);

            expect(result).toBe(Copy.MemoriesUpdatedSuccess);
        });

        it('should reject a line exceeding 200 characters', async () => {
            const longLine = 'a'.repeat(201);

            const result = await service.updateMemories(longLine);

            expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
            expect(result).toBeTypeOf('string');
            expect(result as string).toContain('200');
        });

        it('should accept a line of exactly 200 characters', async () => {
            mockFileSystemService.writeToFilePath.mockResolvedValue(undefined);
            const maxLine = 'a'.repeat(200);

            const result = await service.updateMemories(maxLine);

            expect(result).toBe(Copy.MemoriesUpdatedSuccess);
        });

        it('should handle Windows-style line endings (CRLF) in line count', async () => {
            mockFileSystemService.writeToFilePath.mockResolvedValue(undefined);
            const tenLinesCRLF = Array(10).fill('valid line').join('\r\n');

            const result = await service.updateMemories(tenLinesCRLF);

            expect(result).toBe(Copy.MemoriesUpdatedSuccess);
        });

        it('should reject CRLF content exceeding 10 lines', async () => {
            const elevenLinesCRLF = Array(11).fill('a').join('\r\n');

            const result = await service.updateMemories(elevenLinesCRLF);

            expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
        });
    });

    describe('openMemories', () => {
        it('should open the memories file when it exists', async () => {
            mockFileSystemService.exists.mockResolvedValue(true);

            await service.openMemories();

            expect(mockFileSystemService.writeToFilePath).not.toHaveBeenCalled();
            expect(mockWorkSpaceService.openNoteByPath).toHaveBeenCalledOnce();
        });

        it('should create memories file before opening when it does not exist', async () => {
            mockFileSystemService.exists.mockResolvedValue(false);
            mockFileSystemService.writeToFilePath.mockResolvedValue(undefined);

            await service.openMemories();

            expect(mockFileSystemService.writeToFilePath).toHaveBeenCalledOnce();
            expect(mockWorkSpaceService.openNoteByPath).toHaveBeenCalledOnce();
        });
    });
});

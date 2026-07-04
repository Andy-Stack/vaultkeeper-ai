import { describe, it, expect, vi } from 'vitest';
import { LocalFileService } from '../../AIClasses/Local/LocalFileService';
import { AIProvider } from '../../Enums/ApiProvider';

describe('LocalFileService', () => {
    describe('uploadFile', () => {
        it('should stamp a dummy inline fileID and resolve', async () => {
            const setFileID = vi.fn();
            const attachment = { setFileID } as any;

            const service = new LocalFileService();
            await service.uploadFile(attachment);

            expect(setFileID).toHaveBeenCalledWith(AIProvider.Local, 'inline');
        });
    });

    describe('refreshCache', () => {
        it('should resolve without doing anything', async () => {
            const service = new LocalFileService();
            await expect(service.refreshCache()).resolves.toBeUndefined();
        });
    });

    describe('deleteFile', () => {
        it('should resolve without doing anything', async () => {
            const service = new LocalFileService();
            const attachment = {} as any;
            await expect(service.deleteFile(attachment)).resolves.toBeUndefined();
        });
    });

    describe('listFiles', () => {
        it('should return an empty array', () => {
            const service = new LocalFileService();
            expect(service.listFiles()).toEqual([]);
        });
    });
});

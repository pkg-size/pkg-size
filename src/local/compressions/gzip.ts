import type { ReadStream } from 'node:fs';
import { gzipSizeStream } from 'gzip-size';

export const getGzipSize = (fileStream: ReadStream) => new Promise<number>((resolve) => {
	fileStream.pipe(gzipSizeStream()).on('gzip-size', resolve);
});

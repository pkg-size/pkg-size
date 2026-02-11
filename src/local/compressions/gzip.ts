import type { ReadStream } from 'node:fs';
import { gzipSizeStream } from 'gzip-size';

export const getGzipSize = (fileStream: ReadStream) => new Promise<number>((resolve, reject) => {
	fileStream.on('error', reject);
	fileStream.pipe(gzipSizeStream())
		.on('error', reject)
		.on('gzip-size', resolve);
});

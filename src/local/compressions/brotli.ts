import type { ReadStream } from 'node:fs';
import { stream as brotliStream } from 'brotli-size';

export const getBrotliSize = (fileStream: ReadStream) => new Promise<number>((resolve, reject) => {
	fileStream.on('error', reject);
	fileStream.pipe(brotliStream())
		.on('error', reject)
		.on('brotli-size', resolve);
});

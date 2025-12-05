import type { ReadStream } from 'node:fs';
import { stream as brotliStream } from 'brotli-size';

export const getBrotliSize = (fileStream: ReadStream) => new Promise<number>((resolve) => {
	fileStream.pipe(brotliStream()).on('brotli-size', resolve);
});

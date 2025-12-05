import type { ReadStream } from 'node:fs';
import { PassThrough } from 'node:stream';
import { CompressStream as ZstdCompressStream } from 'zstd-napi';

export const getZstdSize = (fileStream: ReadStream) => new Promise<number>((resolve) => {
	let size = 0;
	const passThrough = new PassThrough();
	const zstdStream = new ZstdCompressStream();

	fileStream.pipe(passThrough);
	passThrough
		.pipe(zstdStream)
		.on('data', (chunk: Buffer) => {
			size += chunk.length;
		})
		.on('end', () => {
			resolve(size);
		});
});

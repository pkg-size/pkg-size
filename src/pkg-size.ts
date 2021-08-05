import path from 'path';
import zlib from 'zlib';
import fs from 'fs';
import packlist from 'npm-packlist';
import tarFs from 'tar-fs';
import gzipSize from 'gzip-size';
import { stream as brotliStream } from 'brotli-size';
import pMap from 'p-map';
import { FileEntry, PkgSizeData } from './interfaces';

async function streamToBuffer(readable) {
	const chunks = [];
	for await (const chunk of readable) {
		chunks.push(chunk);
	}

	return Buffer.concat(chunks);
}

const getTarballSize = async (
	pkgPath: string,
	entries: string[],
): Promise<number> => {
	const tarBuffer = await streamToBuffer(
		tarFs.pack(pkgPath, {
			// clone array because tar-fs mutates it
			entries: entries.slice(),
		})
			.pipe(zlib.createGzip()),
	);

	return Buffer.byteLength(tarBuffer);
};

async function getFileSizes(pkgPath: string, filePath: string): Promise<FileEntry> {
	const fileStream = fs.createReadStream(
		path.join(pkgPath, filePath),
	);

	const [size, sizeGzip, sizeBrotli] = await Promise.all([
		new Promise<number>((resolve) => {
			let totalSize = 0;
			fileStream
				.on('data', (chunk) => {
					totalSize += chunk.length;
				})
				.on('end', () => {
					resolve(totalSize);
				});
		}),
		new Promise<number>((resolve) => {
			fileStream.pipe(gzipSize.stream()).on('gzip-size', resolve);
		}),
		new Promise<number>((resolve) => {
			fileStream.pipe(brotliStream()).on('brotli-size', resolve);
		}),
	]);

	return {
		path: filePath,
		size,
		sizeGzip,
		sizeBrotli,
	};
}

async function pkgSize(pkgPath: string): Promise<PkgSizeData> {
	pkgPath = path.resolve(pkgPath);

	const filesList = await packlist({
		path: pkgPath,
	});

	const [
		tarballSize,
		...files
	] = await pMap(
		[
			getTarballSize(pkgPath, filesList),
			...filesList.map(filePath => getFileSizes(pkgPath, filePath)),
		],
		element => element,
		{ concurrency: 10 }, // To avoid Error: EMFILE, too many open files
	);

	return {
		pkgPath,
		tarballSize,
		files,
	};
}

export default pkgSize;

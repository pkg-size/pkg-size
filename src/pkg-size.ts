import path from 'path';
import zlib from 'zlib';
import fs from 'fs';
import packlist from 'npm-packlist';
import tarFs from 'tar-fs';
import gzipSize from 'gzip-size';
import { stream as brotliStream } from 'brotli-size';
import pMap from 'p-map';
import globToRegexp from 'glob-to-regexp';
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

async function getFileSizes({ sizes, pkgPath, filePath }: {
	sizes: string[];
	pkgPath: string;
	filePath: string;
}): Promise<FileEntry> {
	const result = {
		path: filePath,
		size: undefined,
		sizeGzip: undefined,
		sizeBrotli: undefined,
	};

	if (sizes.length > 0) {
		const fullFilePath = path.join(pkgPath, filePath);
		const fileStream = fs.createReadStream(fullFilePath);

		const calculateSizes = [];

		if (sizes.includes('size')) {
			calculateSizes.push(new Promise<void>((resolve) => {
				let totalSize = 0;
				fileStream
					.on('data', (chunk) => {
						totalSize += chunk.length;
					})
					.on('end', () => {
						result.size = totalSize;
						resolve();
					});
			}));
		}

		if (sizes.includes('gzip')) {
			calculateSizes.push(new Promise<void>((resolve) => {
				fileStream.pipe(gzipSize.stream()).on('gzip-size', (sizeGzip) => {
					result.sizeGzip = sizeGzip;
					resolve();
				});
			}));
		}

		if (sizes.includes('brotli')) {
			calculateSizes.push(new Promise<void>((resolve) => {
				fileStream.pipe(brotliStream()).on('brotli-size', (sizeBrotli) => {
					result.sizeBrotli = sizeBrotli;
					resolve();
				});
			}));
		}

		await Promise.all(calculateSizes);
	}

	return result;
}

type PkgSizeOptions = {
	sizes: string[];
	ignoreFiles?: string;
};

async function pkgSize(pkgPath: string, options?: PkgSizeOptions): Promise<PkgSizeData> {
	pkgPath = path.resolve(pkgPath);

	let filesList = await packlist({
		path: pkgPath,
	});

	if (options?.ignoreFiles) {
		const ignorePattern = globToRegexp(options.ignoreFiles, { extended: true });
		filesList = filesList.filter(filePath => !ignorePattern.test(filePath));
	}

	const [
		tarballSize,
		...files
	] = await pMap(
		[
			getTarballSize(pkgPath, filesList),
			...filesList.map(filePath => getFileSizes({
				sizes: options.sizes,
				pkgPath,
				filePath,
			})),
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

import path from 'node:path';
import zlib from 'node:zlib';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import tarFs from 'tar-fs';
import pMap from 'p-map';
import globToRegexp from 'glob-to-regexp';
import { getPacklist } from '../utils/get-packlist.js';
import type { FileEntry, PkgSizeData, PkgSizeOptions } from './types.js';

const getTarballSize = (
	pkgPath: string,
	entries: string[],
) => new Promise<number>((resolve) => {
	let totalSize = 0;
	tarFs.pack(pkgPath, {
		// clone array because tar-fs mutates it
		entries: entries.slice(),
	})
		.pipe(zlib.createGzip())
		.on('data', (chunk: Buffer) => {
			totalSize += chunk.length;
		})
		.on('end', () => {
			resolve(totalSize);
		});
});

const getFileSizes = async ({ sizes, pkgPath, filePath }: {
	sizes: string[];
	pkgPath: string;
	filePath: string;
}): Promise<FileEntry> => {
	const result: FileEntry = {
		path: filePath,
		size: 0,
		sizeGzip: 0,
		sizeBrotli: 0,
		sizeZstd: 0,
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
			calculateSizes.push((async () => {
				const { getGzipSize } = await import('./compressions/gzip.js');
				result.sizeGzip = await getGzipSize(fileStream);
			})());
		}

		if (sizes.includes('brotli')) {
			calculateSizes.push((async () => {
				const { getBrotliSize } = await import('./compressions/brotli.js');
				result.sizeBrotli = await getBrotliSize(fileStream);
			})());
		}

		if (sizes.includes('zstd')) {
			calculateSizes.push((async () => {
				const { getZstdSize } = await import('./compressions/zstd.js');
				result.sizeZstd = await getZstdSize(fileStream);
			})());
		}

		await Promise.all(calculateSizes);
	}

	return result;
};

const pkgSize = async (
	pkgPath: string,
	options?: PkgSizeOptions,
): Promise<PkgSizeData> => {
	pkgPath = path.resolve(pkgPath);

	const packageJsonPath = path.join(pkgPath, 'package.json');
	const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'));

	let filesList = await getPacklist(pkgPath, packageJson);

	if (options?.ignoreFiles) {
		const ignorePattern = globToRegexp(options.ignoreFiles, { extended: true });
		filesList = filesList.filter(filePath => !ignorePattern.test(filePath));
	}

	const [tarballSize, files] = await Promise.all([
		getTarballSize(pkgPath, filesList),
		pMap(
			filesList,
			filePath => getFileSizes({
				sizes: options?.sizes ?? [],
				pkgPath,
				filePath,
			}),
			{ concurrency: 10 }, // To avoid Error: EMFILE, too many open files
		),
	]);

	return {
		pkgPath,
		tarballSize,
		files,
	};
};

export default pkgSize;

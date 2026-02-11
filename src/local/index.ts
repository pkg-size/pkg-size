import path from 'node:path';
import zlib from 'node:zlib';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import tarFs from 'tar-fs';
import pMap from 'p-map';
import globToRegexp from 'glob-to-regexp';
import type { PackageJson } from 'type-fest';
import { getPacklist } from '../utils/get-packlist.js';
import type { FileEntry, PackageSizeResult, PackageSizeOptions } from './types.js';

const getTarballSize = (
	packagePath: string,
	entries: string[],
) => new Promise<number>((resolve, reject) => {
	let totalSize = 0;
	const packStream = tarFs.pack(packagePath, {
		// clone array because tar-fs mutates it
		entries: entries.slice(),
	});
	packStream.on('error', reject);
	packStream
		.pipe(zlib.createGzip())
		.on('error', reject)
		.on('data', (chunk: Buffer) => {
			totalSize += chunk.length;
		})
		.on('end', () => {
			resolve(totalSize);
		});
});

const getFileSizes = async ({ sizes, packagePath, filePath }: {
	sizes: string[];
	packagePath: string;
	filePath: string;
}): Promise<FileEntry> => {
	const result: FileEntry = {
		path: filePath,
		size: 0,
		sizeGzip: 0,
		sizeBrotli: 0,
	};

	if (sizes.length > 0) {
		const fullFilePath = path.join(packagePath, filePath);
		const fileStream = fs.createReadStream(fullFilePath);
		const calculateSizes = [];

		if (sizes.includes('size')) {
			calculateSizes.push(new Promise<void>((resolve, reject) => {
				let totalSize = 0;
				fileStream
					.on('error', reject)
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

		await Promise.all(calculateSizes);
	}

	return result;
};

const defaultSizes = ['size', 'gzip'];

export const getPackageSize = async (
	packagePath: string,
	options?: PackageSizeOptions,
): Promise<PackageSizeResult> => {
	packagePath = path.resolve(packagePath);

	const packageJsonPath = path.join(packagePath, 'package.json');
	let packageJson: PackageJson;
	try {
		packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8')) as PackageJson;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse ${packageJsonPath}: ${message}`, { cause: error });
	}

	let filesList = await getPacklist(packagePath, packageJson);

	if (options?.ignoreFiles) {
		const ignorePattern = globToRegexp(options.ignoreFiles, { extended: true });
		filesList = filesList.filter(filePath => !ignorePattern.test(filePath));
	}

	const sizes = options?.sizes ?? defaultSizes;

	const [tarballSize, files] = await Promise.all([
		getTarballSize(packagePath, filesList),
		pMap(
			filesList,
			filePath => getFileSizes({
				sizes,
				packagePath,
				filePath,
			}),
			{ concurrency: 10 }, // To avoid Error: EMFILE, too many open files
		),
	]);

	return {
		packagePath,
		tarballSize,
		files,
		privatePackage: Boolean(packageJson.private),
	};
};

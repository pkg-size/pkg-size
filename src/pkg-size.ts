import path from 'path';
// @ts-expect-error
import pack from 'libnpmpack';
import tar, {ReadEntry} from 'tar';
import gzipSize from 'gzip-size';
import {stream as brotliSizeStream} from 'brotli-size';
import {SetRequired} from 'type-fest';

type SafeReadEntry = SetRequired<ReadEntry, 'mode' | 'size'>;

type FileEntry = {
	path: string;
	mode: number;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
};

type PkgSizeData = {
	pkgPath: string;
	tarballSize: number;
	files: FileEntry[];
};

const getCompressionSizes = async (readEntry: SafeReadEntry): Promise<FileEntry> => new Promise((resolve, reject) => {
	const file: FileEntry = {
		/*
		 * Sanitization from UNPKG:
		 * https://github.com/mjackson/unpkg/blob/4774e61d50f76c518d0628cfdf8beede5017455d/modules/actions/serveFileMetadata.js#L23
		 */
		path: readEntry.path.replace(/^[^/]+\/?/, '/'),
		mode: readEntry.mode,
		size: readEntry.size,
		sizeGzip: Number.NaN,
		sizeBrotli: Number.NaN,
	};

	readEntry
		.pipe(brotliSizeStream())
		.on('brotli-size', sizeBrotli => {
			file.sizeBrotli = sizeBrotli;
		})
		.pipe(gzipSize.stream())
		.on('gzip-size', sizeGzip => {
			file.sizeGzip = sizeGzip;
		})

		.on('end', () => resolve(file));
});

/*
 * Based on npm pack logic
 * https://github.com/npm/cli/blob/e9a440bcc5bd9a42dbdbf4bf9340d188c910857c/lib/utils/tar.js
 */
const getTarFiles = async (tarball: Buffer): Promise<FileEntry[]> => new Promise((resolve, reject) => {
	const promises: Array<Promise<FileEntry>> = [];

	tar.list({})
		.on('entry', readEntry => {
			promises.push(getCompressionSizes(readEntry));
		})
		.on('error', error => reject(error))
		.on('finish', () => resolve(Promise.all(promises)))
		.end(tarball);
});

async function pkgSize(pkgPath = ''): Promise<PkgSizeData> {
	pkgPath = path.resolve(pkgPath);
	const tarball = await pack(pkgPath);
	const files = await getTarFiles(tarball);
	return {
		pkgPath,
		tarballSize: tarball.length,
		files,
	};
}

export = pkgSize;

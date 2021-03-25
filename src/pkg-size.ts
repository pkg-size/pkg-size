import path from 'path';
import pack from 'libnpmpack';
import tar, { ReadEntry } from 'tar';
import gzipSize from 'gzip-size';
import brotliSize from 'brotli-size';
import { SetRequired } from 'type-fest';

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

async function streamToBuffer(readable) {
	const chunks = [];
	for await (const chunk of readable) {
		chunks.push(chunk);
	}

	return Buffer.concat(chunks);
}

const getCompressionSizes = async (readEntry: SafeReadEntry): Promise<FileEntry> => {
	const fileBuffer = await streamToBuffer(readEntry);
	const [sizeGzip, sizeBrotli] = await Promise.all([
		gzipSize(fileBuffer),
		brotliSize(fileBuffer),
	]);

	return {
		/*
		 * Sanitization from UNPKG:
		 * https://github.com/mjackson/unpkg/blob/4774e61d50f76c518d0628cfdf8beede5017455d/modules/actions/serveFileMetadata.js#L23
		 */
		path: readEntry.path.replace(/^[^/]+\/?/, '/'),
		mode: readEntry.mode,
		size: readEntry.size,
		sizeGzip,
		sizeBrotli,
	};
};

/*
 * Based on npm pack logic
 * https://github.com/npm/cli/blob/e9a440bcc5bd9a42dbdbf4bf9340d188c910857c/lib/utils/tar.js
 */
const getTarFiles = (
	tarball: Buffer,
): Promise<FileEntry[]> => new Promise((resolve, reject) => {
	const promises: Array<Promise<FileEntry>> = [];

	tar.list({ noResume: true })
		.on('entry', (readEntry) => {
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

export default pkgSize;

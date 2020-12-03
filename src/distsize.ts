import path from 'path';
// @ts-ignore
import pack from 'libnpmpack';
import tarStream, { Headers } from 'tar-stream';
import {Readable} from 'stream';
import gunzipMaybe from 'gunzip-maybe';
import gzipSize from 'gzip-size';
import { stream as brotliSizeStream } from 'brotli-size';
import { SetRequired } from "type-fest";

type FileHeaders = SetRequired<Headers, 'mode' | 'size'>

type FileEntry = {
	path: string;
	mode: number;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
}

type Distsize = {
	pkgPath: string;
	files: FileEntry[];
}

const getTarFiles = (tarball: Buffer): Promise<FileEntry[]> => new Promise((resolve, reject) => {
	const files: FileEntry[] = [];

	Readable.from(tarball)
		.pipe(gunzipMaybe())
		.pipe(tarStream.extract())
		.on('entry', (header: FileHeaders, stream, next) => {
			
			const file: FileEntry = {
				/*
				 * Sanitization from UNPKG:
				 * https://github.com/mjackson/unpkg/blob/4774e61d50f76c518d0628cfdf8beede5017455d/modules/actions/serveFileMetadata.js#L23
				 */
				path: header.name.replace(/^[^/]+\/?/, '/'),
				mode: header.mode,
				size: header.size,
				sizeGzip: NaN,
				sizeBrotli: NaN,
			};

			files.push(file);

			stream = stream
				.pipe(brotliSizeStream())
				.on('brotli-size', sizeBrotli => {
					file.sizeBrotli = sizeBrotli;
				})
				.pipe(gzipSize.stream())
				.on('gzip-size', sizeGzip => {
					file.sizeGzip = sizeGzip;
				});

			stream
				.on('end', next)
				.resume();
		})
		.on('error', error => reject(error))
		.on('finish', () => resolve(files));
});

async function distsize(pkgPath = ''): Promise<Distsize> {
	pkgPath = path.resolve(pkgPath);
	const tarball = await pack(pkgPath);
	const files = await getTarFiles(tarball);
	return {pkgPath, files};
}

export = distsize;

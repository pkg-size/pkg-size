'use strict';

const path = require('path');
const pack = require('libnpmpack');
const tarStream = require('tar-stream');
const {Readable} = require('stream');
const gunzipMaybe = require('gunzip-maybe');
const gzipSize = require('gzip-size');
const brotliSize = require('brotli-size');

const compareFiles = (a, b) => a.brotli - b.brotli;

const getTarFiles = tarball => new Promise((resolve, reject) => {
	const files = [];

	Readable.from(tarball)
		.pipe(gunzipMaybe())
		.pipe(tarStream.extract())
		.on('entry', (header, stream, next) => {
			const file = {
				/*
				 * Sanitization from UNPKG:
				 * https://github.com/mjackson/unpkg/blob/4774e61d50f76c518d0628cfdf8beede5017455d/modules/actions/serveFileMetadata.js#L23
				 */
				path: header.name.replace(/^[^/]+\/?/, '/'),
				mode: header.mode,
				size: header.size,
				sizeGzip: undefined,
				sizeBrotli: undefined,
			};

			files.push(file);

			stream = stream
				.pipe(brotliSize.stream())
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
		.on('finish', () => resolve(files.sort(compareFiles)));
});

async function distsize(pkgPath = '') {
	pkgPath = path.resolve(pkgPath);
	const tarball = await pack(pkgPath);
	return {
		pkgPath,
		files: await getTarFiles(tarball),
	};
}

module.exports = distsize;

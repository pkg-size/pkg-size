import path from 'path';
import packlist from 'npm-packlist';
import concatStream from 'concat-stream';
import tarFs from 'tar-fs';
import gzipSize from 'gzip-size';
import brotliSize from 'brotli-size';
import zlib from 'zlib';
import fs from 'fs';

type FileEntry = {
	path: string;
	size: number;
	sizeGzip: number;
	sizeBrotli: number;
};

type PkgSizeData = {
	pkgPath: string;
	tarballSize: number;
	files: FileEntry[];
};

async function getFileSizes (pkgPath: string, filePath: string): Promise<FileEntry> {
	const fileBuffer = await fs.promises.readFile(path.join(pkgPath, filePath));
	const [stats, sizeGzip, sizeBrotli] = await Promise.all([
		fs.promises.stat(filePath),
		gzipSize(fileBuffer),
		brotliSize(fileBuffer),
	]);

	return {
		path: filePath,
		size: stats.size,
		sizeGzip,
		sizeBrotli,
	};
}

async function getTarballSize(pkgPath, entries): Promise<number> {
	return new Promise((resolve, reject) => {
		tarFs.pack(pkgPath, {
			entries,
		})
			.pipe(zlib.createGzip())
			.pipe(concatStream(
				(tarBuffer) => resolve(Buffer.byteLength(tarBuffer))
			))
			.on('error', (error) => {
				reject(error);
			});
	});
}

async function pkgSize(pkgPath = ''): Promise<PkgSizeData> {
	pkgPath = path.resolve(pkgPath);

	const filesList = await packlist({
		path: pkgPath,
	});

	const [
		tarballSize,
		...files
	] = await Promise.all([
		getTarballSize(pkgPath, filesList),
		...filesList.map((filePath) => getFileSizes(pkgPath, filePath)),
	]);

	return {
		pkgPath,
		tarballSize,
		files,
	};
}

export default pkgSize;

import path from 'path';
import zlib from 'zlib';
import fs from 'fs';
import packlist from 'npm-packlist';
import tarFs from 'tar-fs';
import gzipSize from 'gzip-size';
import brotliSize from 'brotli-size';
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
		tarFs.pack(pkgPath, { entries })
			.pipe(zlib.createGzip()),
	);

	return Buffer.byteLength(tarBuffer);
};

async function getFileSizes(pkgPath: string, filePath: string): Promise<FileEntry> {
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
		...filesList.map(filePath => getFileSizes(pkgPath, filePath)),
	]);

	return {
		pkgPath,
		tarballSize,
		files,
	};
}

export default pkgSize;

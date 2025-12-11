import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// TODO: Replace with fsPromises.mkdtempDisposable() when Node.js 24.4.0+ is minimum version
// https://nodejs.org/api/fs.html#fspromisesmkdtempdisposableprefix-options
export const createDisposableDirectory = async (tempDirectory = os.tmpdir()) => {
	const directoryPath = await fsp.mkdtemp(path.join(tempDirectory, 'pkg-size-'));

	let disposed = false;

	return {
		path: directoryPath,
		[Symbol.asyncDispose]: async () => {
			if (disposed) {
				return;
			}
			disposed = true;
			await fsp.rm(directoryPath, {
				recursive: true,
				force: true,
			}).catch(() => {});
		},
	};
};

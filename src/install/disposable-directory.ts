import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// TODO: Replace with fsPromises.mkdtempDisposable() when Node.js 24.4.0+ is minimum version
// https://nodejs.org/api/fs.html#fspromisesmkdtempdisposableprefix-options
export const createDisposableDirectory = async (tempDirectory = os.tmpdir()) => {
	const directoryPath = await fsp.mkdtemp(path.join(tempDirectory, 'pkg-size-'));

	let disposed = false;

	// Handle SIGINT/SIGTERM for cleanup
	const signalHandler = () => {
		if (!disposed) {
			disposed = true;
			process.off('SIGINT', signalHandler);
			process.off('SIGTERM', signalHandler);
			try {
				fs.rmSync(directoryPath, {
					recursive: true,
					force: true,
				});
			} catch {
				// Ignore cleanup errors on exit
			}
		}
		process.exit(1);
	};

	process.on('SIGINT', signalHandler);
	process.on('SIGTERM', signalHandler);

	const dispose = async () => {
		if (disposed) {
			return;
		}
		disposed = true;
		process.off('SIGINT', signalHandler);
		process.off('SIGTERM', signalHandler);
		await fsp.rm(directoryPath, {
			recursive: true,
			force: true,
		}).catch(() => {});
	};

	return {
		path: directoryPath,
		[Symbol.asyncDispose]: dispose,
	};
};

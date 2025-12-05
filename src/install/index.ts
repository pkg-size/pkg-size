import fsp from 'node:fs/promises';
import path from 'node:path';
import spawn from 'nano-spawn';
import { createDisposableDirectory } from '../utils/disposable-directory.js';
import { detectPackageManager } from '../utils/package-manager.js';
import { getNodeModulesPackages } from './node-modules.js';
import type { InstallSizeData, InstallSizeOptions } from './types.js';

export const installSize = async (
	packageSpecs: string[],
	options: InstallSizeOptions = {},
): Promise<InstallSizeData> => {
	const packageManager = options.packageManager ?? detectPackageManager();

	await using tempDirectory = await createDisposableDirectory();

	// Create minimal package.json
	await fsp.writeFile(
		path.join(tempDirectory.path, 'package.json'),
		'{}',
	);

	// Install packages
	const installCommand = packageManager === 'yarn' ? 'add' : 'install';

	let result;
	try {
		result = await spawn(packageManager, [installCommand, ...packageSpecs], {
			cwd: tempDirectory.path,
			stdout: 'ignore',
			stderr: 'pipe',
		});
	} catch (error) {
		const spawnError = error as { stderr?: string };
		if (spawnError.stderr) {
			process.stderr.write(spawnError.stderr);
		}
		throw error;
	}
	const installTime = result.durationMs;

	// Measure node_modules
	const packages = await getNodeModulesPackages(path.join(tempDirectory.path, 'node_modules'));

	let totalSize = 0;
	let totalFiles = 0;
	for (const pkg of packages) {
		totalSize += pkg.size;
		totalFiles += pkg.files;
	}

	return {
		packages,
		totalSize,
		totalFiles,
		installTime,
		packageManager,
	};
};


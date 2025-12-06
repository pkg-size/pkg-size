import fsp from 'node:fs/promises';
import path from 'node:path';
import spawn from 'nano-spawn';
import { detectPackageManager } from '../utils/package-manager.js';
import { createDisposableDirectory } from './disposable-directory.js';
import { analyzeNodeModules } from './analyze-node-modules.js';
import type { InstallSizeResult, InstallSizeOptions } from './types.js';

export const getInstallSize = async (
	packages: string | string[],
	options: InstallSizeOptions = {},
): Promise<InstallSizeResult> => {
	const packageSpecs = Array.isArray(packages) ? packages : packages.trim().split(/\s+/);
	const packageManager = options.packageManager ?? detectPackageManager();

	await using installedDirectory = await createDisposableDirectory(options.tempDirectory);

	// Create minimal package.json
	await fsp.writeFile(
		path.join(installedDirectory.path, 'package.json'),
		'{}',
	);

	// Install packages
	const installCommand = packageManager === 'yarn' ? 'add' : 'install';

	let result;
	try {
		result = await spawn(packageManager, [installCommand, ...packageSpecs], {
			cwd: installedDirectory.path,
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

	const { packages: installedPackages, totalSize } = await analyzeNodeModules(installedDirectory.path);

	return {
		packages: installedPackages,
		totalSize,
		installTime,
		packageManager,
	};
};

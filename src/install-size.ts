import fsp from 'node:fs/promises';
import path from 'node:path';
import spawn from 'nano-spawn';
import pMap from 'p-map';
import { createDisposableDirectory } from './utils/disposable-directory.js';

export type PackageEntry = {
	name: string;
	size: number;
	files: number;
};

export type InstallSizeData = {
	packages: PackageEntry[];
	totalSize: number;
	totalFiles: number;
	installTime: number;
	packageManager: string;
};

const detectPackageManager = (): string => {
	const agent = process.env.npm_config_user_agent || '';
	if (agent.startsWith('pnpm')) {
		return 'pnpm';
	}
	if (agent.startsWith('yarn')) {
		return 'yarn';
	}
	return 'npm';
};

// Only explicit path indicators - no fs.existsSync to avoid shadowing
// (e.g., a folder named "test" shouldn't shadow the npm package "test")
const isLocalPath = (argument: string): boolean => (
	argument.startsWith('.') || path.isAbsolute(argument)
);

export type SizeResult = {
	size: number;
	files: number;
};

// Concurrency limit to avoid EMFILE (too many open files)
const statConcurrency = 100;

const getDirectorySize = async (directory: string): Promise<SizeResult> => {
	// Collect all file paths first, then stat with limited concurrency
	const filePaths: string[] = [];

	const collectFiles = async (currentDirectory: string): Promise<void> => {
		const entries = await fsp.readdir(currentDirectory, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDirectory, entry.name);

			if (entry.isDirectory()) {
				await collectFiles(fullPath);
			} else if (entry.isFile()) {
				filePaths.push(fullPath);
			}
			// Skip symlinks - we read from actual package directories
		}
	};

	await collectFiles(directory);

	// Stat files with concurrency limit
	const sizes = await pMap(
		filePaths,
		async (filePath) => {
			const stats = await fsp.stat(filePath);
			return stats.size;
		},
		{ concurrency: statConcurrency },
	);

	let totalSize = 0;
	for (const size of sizes) {
		totalSize += size;
	}

	return {
		size: totalSize,
		files: filePaths.length,
	};
};

// Collect packages from a directory, handling scoped packages (@org/pkg)
const collectPackagesFromDirectory = async (
	directory: string,
	packages: PackageEntry[],
	skipHidden = false,
): Promise<void> => {
	const entries = await fsp.readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip hidden folders when requested (for npm/yarn flat node_modules)
		if (skipHidden && entry.name.startsWith('.')) {
			continue;
		}

		const fullPath = path.join(directory, entry.name);

		// Handle scoped packages (@org/pkg)
		if (entry.name.startsWith('@')) {
			const scopedEntries = await fsp.readdir(fullPath, { withFileTypes: true });
			for (const scopedEntry of scopedEntries) {
				if (scopedEntry.isDirectory()) {
					const scopedPath = path.join(fullPath, scopedEntry.name);
					const { size, files } = await getDirectorySize(scopedPath);
					packages.push({
						name: `${entry.name}/${scopedEntry.name}`,
						size,
						files,
					});
				}
			}
		} else {
			const { size, files } = await getDirectorySize(fullPath);
			packages.push({
				name: entry.name,
				size,
				files,
			});
		}
	}
};

// Get packages from pnpm's .pnpm directory (content-addressable store)
const getPnpmPackages = async (
	pnpmPath: string,
): Promise<PackageEntry[]> => {
	const packages: PackageEntry[] = [];

	const exists = await fsp.access(pnpmPath).then(() => true, () => false);
	if (!exists) {
		return packages;
	}

	const entries = await fsp.readdir(pnpmPath, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip special directories
		if (entry.name === 'node_modules' || entry.name === 'lock.yaml') {
			continue;
		}

		// Read the actual package name from the filesystem
		// Structure: .pnpm/{hash}/node_modules/{actual-package-name}
		const innerNodeModules = path.join(pnpmPath, entry.name, 'node_modules');
		const innerExists = await fsp.access(innerNodeModules).then(() => true, () => false);
		if (innerExists) {
			await collectPackagesFromDirectory(innerNodeModules, packages);
		}
	}

	return packages;
};

// Get packages from flat node_modules (npm/yarn)
const getFlatPackages = async (
	nodeModulesPath: string,
): Promise<PackageEntry[]> => {
	const packages: PackageEntry[] = [];
	await collectPackagesFromDirectory(nodeModulesPath, packages, true);
	return packages;
};

const getNodeModulesPackages = async (
	nodeModulesPath: string,
): Promise<PackageEntry[]> => {
	const exists = await fsp.access(nodeModulesPath).then(() => true, () => false);
	if (!exists) {
		return [];
	}

	// Check if this is a pnpm install (has .pnpm directory)
	const pnpmPath = path.join(nodeModulesPath, '.pnpm');
	const isPnpm = await fsp.access(pnpmPath).then(() => true, () => false);

	if (isPnpm) {
		return getPnpmPackages(pnpmPath);
	}

	return getFlatPackages(nodeModulesPath);
};

export type InstallSizeOptions = {
	packageManager?: string;
};

const installSize = async (
	packageSpecs: string[],
	options: InstallSizeOptions = {},
): Promise<InstallSizeData> => {
	const packageManager = options.packageManager ?? detectPackageManager();

	await using tempDirectory = await createDisposableDirectory();

	// Create minimal package.json
	await fsp.writeFile(
		path.join(tempDirectory.path, 'package.json'),
		JSON.stringify({}),
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
	const nodeModulesPath = path.join(tempDirectory.path, 'node_modules');
	const packages = await getNodeModulesPackages(nodeModulesPath);

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

export {
	installSize,
	isLocalPath,
	detectPackageManager,
};

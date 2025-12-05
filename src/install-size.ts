import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import spawn from 'nano-spawn';
import pMap from 'p-map';

type PackageEntry = {
	name: string;
	size: number;
	files: number;
};

type InstallSizeData = {
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

type SizeResult = {
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

// Parse pnpm store directory name to extract package name
// Format: {package-name}@{version} or @{scope}+{name}@{version}
const parsePnpmPackageName = (directoryName: string): string | null => {
	// Find the last @ which separates name from version
	const lastAtIndex = directoryName.lastIndexOf('@');
	if (lastAtIndex <= 0) {
		return null;
	}

	const namePart = directoryName.slice(0, lastAtIndex);

	// Scoped packages use + instead of / in pnpm store
	// e.g., @babel+core@7.0.0 -> @babel/core
	if (namePart.startsWith('@') && namePart.includes('+')) {
		return namePart.replace('+', '/');
	}

	return namePart;
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

		const packageName = parsePnpmPackageName(entry.name);
		if (!packageName) {
			continue;
		}

		// The actual package content is at .pnpm/{name}@{version}/node_modules/{name}
		const packagePath = path.join(pnpmPath, entry.name, 'node_modules', packageName);
		const packageExists = await fsp.access(packagePath).then(() => true, () => false);

		if (packageExists) {
			const { size, files } = await getDirectorySize(packagePath);
			packages.push({
				name: packageName,
				size,
				files,
			});
		}
	}

	return packages;
};

// Get packages from flat node_modules (npm/yarn)
const getFlatPackages = async (
	nodeModulesPath: string,
): Promise<PackageEntry[]> => {
	const packages: PackageEntry[] = [];

	const entries = await fsp.readdir(nodeModulesPath, { withFileTypes: true });

	for (const entry of entries) {
		// Skip hidden folders and files
		if (entry.name.startsWith('.')) {
			continue;
		}

		if (!entry.isDirectory()) {
			continue;
		}

		const fullPath = path.join(nodeModulesPath, entry.name);

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

type InstallSizeOptions = {
	packageManager?: string;
};

const installSize = async (
	packageSpecs: string[],
	options: InstallSizeOptions = {},
): Promise<InstallSizeData> => {
	const packageManager = options.packageManager ?? detectPackageManager();

	// Create temp directory
	const tempDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pkg-size-'));

	// Cleanup helper - nulls the path before deletion to prevent race condition
	let tempPath: string | null = tempDirectory;

	const cleanup = async () => {
		const directoryToRemove = tempPath;
		tempPath = null;
		if (directoryToRemove) {
			await fsp.rm(directoryToRemove, {
				recursive: true,
				force: true,
			}).catch(() => {});
		}
	};

	// Signal handler scoped to this invocation
	const signalHandler = () => {
		const directoryToRemove = tempPath;
		tempPath = null;
		if (directoryToRemove) {
			try {
				fs.rmSync(directoryToRemove, {
					recursive: true,
					force: true,
				});
			} catch {
				// Ignore cleanup errors on exit
			}
		}
		process.exit(1);
	};

	// Attach signal handlers for this run only
	process.on('SIGINT', signalHandler);
	process.on('SIGTERM', signalHandler);

	try {
		// Create minimal package.json
		await fsp.writeFile(
			path.join(tempDirectory, 'package.json'),
			JSON.stringify({
				name: 'pkg-size-temp',
				version: '0.0.0',
				private: true,
			}),
		);

		// Install packages
		const installArgs = packageManager === 'yarn'
			? ['add', ...packageSpecs]
			: ['install', ...packageSpecs];

		let result;
		try {
			result = await spawn(packageManager, installArgs, {
				cwd: tempDirectory,
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
		const nodeModulesPath = path.join(tempDirectory, 'node_modules');
		const packages = await getNodeModulesPackages(nodeModulesPath);

		// Sort by size descending
		packages.sort((a, b) => b.size - a.size);

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
	} finally {
		// Detach signal handlers to avoid leaking listeners
		process.off('SIGINT', signalHandler);
		process.off('SIGTERM', signalHandler);
		await cleanup();
	}
};

export {
	installSize,
	isLocalPath,
	detectPackageManager,
};

export type {
	PackageEntry,
	InstallSizeData,
	InstallSizeOptions,
};

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import spawn from 'nano-spawn';

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

const isLocalPath = (argument: string): boolean => (
	argument.startsWith('.')
	|| argument.startsWith('/')
	|| argument.startsWith('~')
	|| fs.existsSync(argument)
);

const getDirectorySize = async (directory: string): Promise<{ size: number;
	files: number; }> => {
	let size = 0;
	let files = 0;

	const walk = async (currentDirectory: string): Promise<void> => {
		const entries = await fsp.readdir(currentDirectory, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDirectory, entry.name);

			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile()) {
				const stats = await fsp.stat(fullPath);
				size += stats.size;
				files += 1;
			}
		}
	};

	await walk(directory);
	return {
		size,
		files,
	};
};

const getNodeModulesPackages = async (
	nodeModulesPath: string,
): Promise<PackageEntry[]> => {
	const packages: PackageEntry[] = [];

	const exists = await fsp.access(nodeModulesPath).then(() => true, () => false);
	if (!exists) {
		return packages;
	}

	const entries = await fsp.readdir(nodeModulesPath, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip hidden folders like .pnpm, .cache
		if (entry.name.startsWith('.')) {
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

const installSize = async (packageSpecs: string[]): Promise<InstallSizeData> => {
	const packageManager = detectPackageManager();

	// Create temp directory
	const tempDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), 'pkg-size-'));

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

		const result = await spawn(packageManager, installArgs, {
			cwd: tempDirectory,
			stdio: 'inherit',
		});
		const installTime = result.durationMs;

		// Measure node_modules
		const nodeModulesPath = path.join(tempDirectory, 'node_modules');
		const packages = await getNodeModulesPackages(nodeModulesPath);

		// Sort by size descending
		packages.sort((a, b) => b.size - a.size);

		const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0);
		const totalFiles = packages.reduce((sum, pkg) => sum + pkg.files, 0);

		return {
			packages,
			totalSize,
			totalFiles,
			installTime,
			packageManager,
		};
	} finally {
		// Cleanup temp directory
		await fsp.rm(tempDirectory, {
			recursive: true,
			force: true,
		});
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
};

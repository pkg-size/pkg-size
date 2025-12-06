import fsp from 'node:fs/promises';
import path from 'node:path';
import pMap from 'p-map';
import { fsExists } from '../utils/fs-exists.js';
import type { PackageFile, InstalledPackage, SizeResult } from './types.js';

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
	const fileEntries = await pMap(
		filePaths,
		async (filePath): Promise<PackageFile> => {
			const stats = await fsp.stat(filePath);
			return {
				path: path.relative(directory, filePath),
				size: stats.size,
			};
		},
		{ concurrency: statConcurrency },
	);

	let totalSize = 0;
	for (const file of fileEntries) {
		totalSize += file.size;
	}

	return {
		size: totalSize,
		files: fileEntries,
	};
};

// Collect packages from a directory, handling scoped packages (@org/pkg)
const collectPackagesFromDirectory = async (
	directory: string,
	packages: InstalledPackage[],
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
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];

	const exists = await fsExists(pnpmPath);
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
		const innerExists = await fsExists(innerNodeModules);
		if (innerExists) {
			await collectPackagesFromDirectory(innerNodeModules, packages);
		}
	}

	return packages;
};

// Get packages from flat node_modules (npm/yarn)
const getFlatPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectPackagesFromDirectory(nodeModulesPath, packages, true);
	return packages;
};

export const getNodeModulesPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const exists = await fsExists(nodeModulesPath);
	if (!exists) {
		return [];
	}

	// Check if this is a pnpm install (has .pnpm directory)
	const pnpmPath = path.join(nodeModulesPath, '.pnpm');
	const isPnpm = await fsExists(pnpmPath);

	if (isPnpm) {
		return getPnpmPackages(pnpmPath);
	}

	return getFlatPackages(nodeModulesPath);
};

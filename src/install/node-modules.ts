import fsp from 'node:fs/promises';
import path from 'node:path';
import { fdir as Fdir } from 'fdir';
import pMap from 'p-map';
import { fsExists } from '../utils/fs-exists.js';
import type { PackageFile, InstalledPackage, SizeResult } from './types.js';

type PackageMetadata = {
	version: string;
	license?: string;
	author?: string;
};

const normalizeAuthor = (
	author: unknown,
): string | undefined => {
	if (typeof author === 'string') {
		return author;
	}
	if (author && typeof author === 'object' && 'name' in author) {
		const authorObject = author as { name?: string;
			email?: string; };
		if (typeof authorObject.name === 'string') {
			return authorObject.email
				? `${authorObject.name} <${authorObject.email}>`
				: authorObject.name;
		}
	}
	return undefined;
};

const getPackageMetadata = async (
	packageDirectory: string,
): Promise<PackageMetadata> => {
	const packageJsonPath = path.join(packageDirectory, 'package.json');
	const exists = await fsExists(packageJsonPath);
	if (!exists) {
		return { version: '' };
	}

	try {
		const content = await fsp.readFile(packageJsonPath, 'utf8');
		const packageJson = JSON.parse(content) as Record<string, unknown>;
		return {
			version: typeof packageJson.version === 'string' ? packageJson.version : '',
			license: typeof packageJson.license === 'string' ? packageJson.license : undefined,
			author: normalizeAuthor(packageJson.author),
		};
	} catch {
		return { version: '' };
	}
};

// Concurrency limit to avoid EMFILE (too many open files)
const statConcurrency = 100;

const getDirectorySize = async (directory: string): Promise<SizeResult> => {
	const filePaths = await new Fdir()
		.withRelativePaths()
		.crawl(directory)
		.withPromise();

	const files = await pMap(
		filePaths,
		async (relativePath): Promise<PackageFile> => {
			const stats = await fsp.stat(path.join(directory, relativePath));
			return {
				path: relativePath,
				size: stats.size,
			};
		},
		{ concurrency: statConcurrency },
	);

	let size = 0;
	for (const file of files) {
		size += file.size;
	}

	return {
		size,
		files,
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
					const [{ size, files }, metadata] = await Promise.all([
						getDirectorySize(scopedPath),
						getPackageMetadata(scopedPath),
					]);
					packages.push({
						name: `${entry.name}/${scopedEntry.name}`,
						size,
						files,
						...metadata,
					});
				}
			}
		} else {
			const [{ size, files }, metadata] = await Promise.all([
				getDirectorySize(fullPath),
				getPackageMetadata(fullPath),
			]);
			packages.push({
				name: entry.name,
				size,
				files,
				...metadata,
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

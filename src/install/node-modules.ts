import fsp from 'node:fs/promises';
import path from 'node:path';
import { fdir as Fdir } from 'fdir';
import pMap from 'p-map';
import type { PackageJson } from 'type-fest';
import { fsExists } from '../utils/fs-exists.js';
import type {
	PackageFile,
	PackageReference,
	InstalledPackage,
	SizeResult,
} from './types.js';

type PackageMetadata = {
	version: string;
	license?: string;
	author?: string;
};

const normalizeAuthor = (
	author: PackageJson.Person | undefined,
): string | undefined => {
	if (!author) {
		return undefined;
	}
	if (typeof author === 'string') {
		return author;
	}
	return author.email
		? `${author.name} <${author.email}>`
		: author.name;
};

// Handle legacy license formats: object { type, url } or array of objects
const normalizeLicense = (
	license: unknown,
	licenses: PackageJson['licenses'],
): string | undefined => {
	if (typeof license === 'string') {
		return license;
	}
	// Handle legacy object format: { type: "MIT", url: "..." }
	if (license && typeof license === 'object' && 'type' in license) {
		const licenseObject = license as { type?: string };
		if (typeof licenseObject.type === 'string') {
			return licenseObject.type;
		}
	}
	// Fall back to deprecated licenses array
	if (licenses && licenses.length > 0) {
		return licenses
			.map(l => l.type)
			.filter(Boolean)
			.join(', ') || undefined;
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
		const packageJson = JSON.parse(content) as PackageJson;
		return {
			version: packageJson.version ?? '',
			license: normalizeLicense(packageJson.license, packageJson.licenses),
			author: normalizeAuthor(packageJson.author),
		};
	} catch {
		return { version: '' };
	}
};

// Concurrency limit to avoid EMFILE (too many open files)
const statConcurrency = 100;

const getDirectorySizeExcludingNodeModules = async (directory: string): Promise<SizeResult> => {
	const filePaths = await new Fdir()
		.withRelativePaths()
		.exclude((_directoryName, directoryPath) => directoryPath.includes('node_modules'))
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

// Recursively collect packages from nested node_modules (npm --install-strategy=nested)
const collectNestedPackages = async (
	directory: string,
	packages: InstalledPackage[],
	parentPath: PackageReference[],
): Promise<void> => {
	const exists = await fsExists(directory);
	if (!exists) {
		return;
	}

	const entries = await fsp.readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip hidden folders
		if (entry.name.startsWith('.')) {
			continue;
		}

		const fullPath = path.join(directory, entry.name);

		// Handle scoped packages (@org/pkg)
		if (entry.name.startsWith('@')) {
			const scopedEntries = await fsp.readdir(fullPath, { withFileTypes: true });
			for (const scopedEntry of scopedEntries) {
				if (scopedEntry.isDirectory()) {
					const scopedPath = path.join(fullPath, scopedEntry.name);
					const packageName = `${entry.name}/${scopedEntry.name}`;

					const [{ size, files }, metadata] = await Promise.all([
						getDirectorySizeExcludingNodeModules(scopedPath),
						getPackageMetadata(scopedPath),
					]);

					const pkg: InstalledPackage = {
						name: packageName,
						size,
						files,
						path: parentPath,
						...metadata,
					};
					packages.push(pkg);

					// Recursively check for nested node_modules
					const nestedNodeModules = path.join(scopedPath, 'node_modules');
					const currentRef: PackageReference = {
						name: packageName,
						version: metadata.version,
					};
					await collectNestedPackages(nestedNodeModules, packages, [...parentPath, currentRef]);
				}
			}
		} else {
			const [{ size, files }, metadata] = await Promise.all([
				getDirectorySizeExcludingNodeModules(fullPath),
				getPackageMetadata(fullPath),
			]);

			const pkg: InstalledPackage = {
				name: entry.name,
				size,
				files,
				path: parentPath,
				...metadata,
			};
			packages.push(pkg);

			// Recursively check for nested node_modules
			const nestedNodeModules = path.join(fullPath, 'node_modules');
			const currentRef: PackageReference = {
				name: entry.name,
				version: metadata.version,
			};
			await collectNestedPackages(nestedNodeModules, packages, [...parentPath, currentRef]);
		}
	}
};

// Get packages from npm nested install (--install-strategy=nested)
const getNpmNestedPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectNestedPackages(nodeModulesPath, packages, []);
	return packages;
};

// Collect packages from a directory without recursion (for pnpm/flat structures)
const collectPackagesFlat = async (
	directory: string,
	packages: InstalledPackage[],
	skipHidden = false,
): Promise<void> => {
	const entries = await fsp.readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip hidden folders when requested
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
						getDirectorySizeExcludingNodeModules(scopedPath),
						getPackageMetadata(scopedPath),
					]);
					packages.push({
						name: `${entry.name}/${scopedEntry.name}`,
						size,
						files,
						path: [],
						...metadata,
					});
				}
			}
		} else {
			const [{ size, files }, metadata] = await Promise.all([
				getDirectorySizeExcludingNodeModules(fullPath),
				getPackageMetadata(fullPath),
			]);
			packages.push({
				name: entry.name,
				size,
				files,
				path: [],
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
			await collectPackagesFlat(innerNodeModules, packages);
		}
	}

	return packages;
};

// Get packages from flat node_modules (yarn or npm hoisted)
const getFlatPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectPackagesFlat(nodeModulesPath, packages, true);
	return packages;
};

export const getNodeModulesPackages = async (
	nodeModulesPath: string,
	packageManager?: string,
): Promise<InstalledPackage[]> => {
	const exists = await fsExists(nodeModulesPath);
	if (!exists) {
		return [];
	}

	// If package manager is known, use the appropriate strategy
	if (packageManager === 'npm') {
		return getNpmNestedPackages(nodeModulesPath);
	}

	if (packageManager === 'pnpm') {
		const pnpmPath = path.join(nodeModulesPath, '.pnpm');
		return getPnpmPackages(pnpmPath);
	}

	// For yarn or unknown, check filesystem structure
	const pnpmPath = path.join(nodeModulesPath, '.pnpm');
	const isPnpm = await fsExists(pnpmPath);

	if (isPnpm) {
		return getPnpmPackages(pnpmPath);
	}

	// Check for nested node_modules (npm nested strategy)
	const entries = await fsp.readdir(nodeModulesPath, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('@')) {
			const nestedPath = path.join(nodeModulesPath, entry.name, 'node_modules');
			const hasNested = await fsExists(nestedPath);
			if (hasNested) {
				return getNpmNestedPackages(nodeModulesPath);
			}
			break; // Only check first package
		}
	}

	return getFlatPackages(nodeModulesPath);
};

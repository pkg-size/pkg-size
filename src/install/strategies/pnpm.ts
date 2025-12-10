import type { Dirent } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { PackageJson } from 'type-fest';
import { fsExists } from '../../utils/fs-exists.js';
import type { InstalledPackage, PackageReference } from '../types.js';
import { getDirectorySizeExcludingNodeModules } from '../utils/scanner.js';
import { getPackageMetadata } from '../utils/metadata.js';
import { parsePnpmDirName } from '../utils/pnpm-parser.js';

// Fallback: read package name/version from the first real directory's package.json
// Used when pnpm directory name is hashed (MD5) and can't be parsed
const getPackageRefFromDirectory = async (
	pnpmEntryPath: string,
): Promise<PackageReference | undefined> => {
	const innerNodeModules = path.join(pnpmEntryPath, 'node_modules');
	const innerExists = await fsExists(innerNodeModules);
	if (!innerExists) {
		return undefined;
	}

	const innerEntries = await fsp.readdir(innerNodeModules, { withFileTypes: true });

	// Find the first real directory (not symlink) - that's the actual package
	for (const entry of innerEntries) {
		if (entry.name.startsWith('@')) {
			// Scoped package - look inside
			const scopedPath = path.join(innerNodeModules, entry.name);
			const scopedEntries = await fsp.readdir(scopedPath, { withFileTypes: true });
			for (const scopedEntry of scopedEntries) {
				if (scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) {
					const packageJsonPath = path.join(scopedPath, scopedEntry.name, 'package.json');
					try {
						const content = await fsp.readFile(packageJsonPath, 'utf8');
						const packageJson = JSON.parse(content) as PackageJson;
						if (packageJson.name && packageJson.version) {
							return {
								name: packageJson.name,
								version: packageJson.version,
							};
						}
					} catch {
						// Continue searching
					}
				}
			}
		} else if (entry.isDirectory() && !entry.isSymbolicLink()) {
			const packageJsonPath = path.join(innerNodeModules, entry.name, 'package.json');
			try {
				const content = await fsp.readFile(packageJsonPath, 'utf8');
				const packageJson = JSON.parse(content) as PackageJson;
				if (packageJson.name && packageJson.version) {
					return {
						name: packageJson.name,
						version: packageJson.version,
					};
				}
			} catch {
				// Continue searching
			}
		}
	}

	return undefined;
};

// Recursively build the full dependency path from root to a package
const buildDependencyPath = (
	packageName: string,
	dependencyMap: Map<string, PackageReference[]>,
	visited: Set<string> = new Set(),
): PackageReference[] => {
	// Prevent cycles
	if (visited.has(packageName)) {
		return [];
	}
	visited.add(packageName);

	const parents = dependencyMap.get(packageName);
	if (!parents || parents.length === 0) {
		// Root package - no parent
		return [];
	}

	// Take first parent and recursively build its path
	const parent = parents[0];
	const parentPath = buildDependencyPath(parent.name, dependencyMap, visited);

	return [...parentPath, parent];
};

// Build dependency map by analyzing symlinks in each package's node_modules
const buildDependencyMap = async (
	pnpmPath: string,
	entries: Dirent[],
): Promise<Map<string, PackageReference[]>> => {
	const dependencyMap = new Map<string, PackageReference[]>();

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip special directories
		if (entry.name === 'node_modules' || entry.name === 'lock.yaml') {
			continue;
		}

		// Parse parent package info from directory name
		// Fallback to reading package.json if directory name is hashed
		let parentRef = parsePnpmDirName(entry.name);
		if (!parentRef) {
			parentRef = await getPackageRefFromDirectory(path.join(pnpmPath, entry.name));
			if (!parentRef) {
				continue;
			}
		}

		// Check node_modules inside this package directory
		const innerNodeModules = path.join(pnpmPath, entry.name, 'node_modules');
		const innerExists = await fsExists(innerNodeModules);
		if (!innerExists) {
			continue;
		}

		// Find symlinks (dependencies) in this node_modules
		const innerEntries = await fsp.readdir(innerNodeModules, { withFileTypes: true });
		for (const innerEntry of innerEntries) {
			// Handle scoped packages
			if (innerEntry.name.startsWith('@') && innerEntry.isDirectory()) {
				const scopedPath = path.join(innerNodeModules, innerEntry.name);
				const scopedEntries = await fsp.readdir(scopedPath, { withFileTypes: true });
				for (const scopedEntry of scopedEntries) {
					if (scopedEntry.isSymbolicLink()) {
						const depName = `${innerEntry.name}/${scopedEntry.name}`;
						const parents = dependencyMap.get(depName) || [];
						parents.push(parentRef);
						dependencyMap.set(depName, parents);
					}
				}
			} else if (innerEntry.isSymbolicLink()) {
				// Regular package symlink = dependency of parent
				const parents = dependencyMap.get(innerEntry.name) || [];
				parents.push(parentRef);
				dependencyMap.set(innerEntry.name, parents);
			}
		}
	}

	return dependencyMap;
};

// Collect packages from pnpm's .pnpm directory
const collectPnpmPackages = async (
	pnpmPath: string,
	entries: Dirent[],
	dependencyMap: Map<string, PackageReference[]>,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		if (entry.name === 'node_modules' || entry.name === 'lock.yaml') {
			continue;
		}

		const innerNodeModules = path.join(pnpmPath, entry.name, 'node_modules');
		const innerExists = await fsExists(innerNodeModules);
		if (!innerExists) {
			continue;
		}

		const innerEntries = await fsp.readdir(innerNodeModules, { withFileTypes: true });
		for (const innerEntry of innerEntries) {
			// Handle scoped packages
			if (innerEntry.name.startsWith('@') && innerEntry.isDirectory()) {
				const scopedPath = path.join(innerNodeModules, innerEntry.name);
				const scopedEntries = await fsp.readdir(scopedPath, { withFileTypes: true });
				for (const scopedEntry of scopedEntries) {
					// Only process real directories (not symlinks)
					if (scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) {
						const pkgPath = path.join(scopedPath, scopedEntry.name);
						const packageName = `${innerEntry.name}/${scopedEntry.name}`;
						const [{ size, files }, metadata] = await Promise.all([
							getDirectorySizeExcludingNodeModules(pkgPath),
							getPackageMetadata(pkgPath),
						]);

						// Build full dependency path from root to this package
						const dependencyPath = buildDependencyPath(packageName, dependencyMap);

						packages.push({
							name: packageName,
							size,
							files,
							path: dependencyPath,
							dependencySize: 0,
							dependencyCount: 0,
							...metadata,
						});
					}
				}
			} else if (innerEntry.isDirectory() && !innerEntry.isSymbolicLink()) {
				// Real directory = the package itself
				const pkgPath = path.join(innerNodeModules, innerEntry.name);
				const [{ size, files }, metadata] = await Promise.all([
					getDirectorySizeExcludingNodeModules(pkgPath),
					getPackageMetadata(pkgPath),
				]);

				// Build full dependency path from root to this package
				const dependencyPath = buildDependencyPath(innerEntry.name, dependencyMap);

				packages.push({
					name: innerEntry.name,
					size,
					files,
					path: dependencyPath,
					dependencySize: 0,
					dependencyCount: 0,
					...metadata,
				});
			}
		}
	}

	return packages;
};

// Get packages from pnpm's .pnpm directory (content-addressable store)
// Build dependency paths by analyzing symlinks in each package's node_modules
export const getPnpmPackages = async (
	pnpmPath: string,
): Promise<InstalledPackage[]> => {
	const exists = await fsExists(pnpmPath);
	if (!exists) {
		return [];
	}

	const entries = await fsp.readdir(pnpmPath, { withFileTypes: true });

	// First pass: build a map of which packages depend on which
	const dependencyMap = await buildDependencyMap(pnpmPath, entries);

	// Second pass: collect packages with their paths
	return collectPnpmPackages(pnpmPath, entries, dependencyMap);
};

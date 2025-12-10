import type { Dirent } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fsExists } from '../../utils/fs-exists.js';
import type { InstalledPackage, PackageReference } from '../types.js';
import { getDirectorySizeExcludingNodeModules } from '../utils/scanner.js';
import { getPackageMetadata } from '../utils/metadata.js';
import { parsePnpmDirName } from '../utils/pnpm-parser.js';

type DependencyPathResult = {
	path: PackageReference[];
	additionalParentCount: number;
};

// Recursively build the full dependency path from root to a package
// Also returns count of additional parents not shown in the path
const buildDependencyPath = (
	packageName: string,
	dependencyMap: Map<string, PackageReference[]>,
	visited: Set<string> = new Set(),
): DependencyPathResult => {
	// Prevent cycles
	if (visited.has(packageName)) {
		return {
			path: [],
			additionalParentCount: 0,
		};
	}
	visited.add(packageName);

	const parents = dependencyMap.get(packageName);
	if (!parents || parents.length === 0) {
		// Root package - no parent
		return {
			path: [],
			additionalParentCount: 0,
		};
	}

	// Take first parent and recursively build its path
	const parent = parents[0];
	const parentResult = buildDependencyPath(parent.name, dependencyMap, visited);

	return {
		path: [...parentResult.path, parent],
		// Count additional parents for this package (not the parents up the chain)
		additionalParentCount: parents.length - 1,
	};
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
		const parentRef = parsePnpmDirName(entry.name);
		if (!parentRef) {
			continue;
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
						const { path: dependencyPath, additionalParentCount } = buildDependencyPath(
							packageName,
							dependencyMap,
						);

						packages.push({
							name: packageName,
							size,
							files,
							path: dependencyPath,
							additionalParentCount,
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
				const { path: dependencyPath, additionalParentCount } = buildDependencyPath(
					innerEntry.name,
					dependencyMap,
				);

				packages.push({
					name: innerEntry.name,
					size,
					files,
					path: dependencyPath,
					additionalParentCount,
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

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fsExists } from '../utils/fs-exists.js';
import type { InstalledPackage } from './types.js';
import { getNpmNestedPackages } from './strategies/npm-nested.js';
import { getPnpmPackages } from './strategies/pnpm.js';
import { getFlatPackages } from './strategies/flat.js';

type DependencyStats = {
	size: number;
	count: number;
};

const packageKey = (name: string, version: string) => `${name}@${version}`;

// Calculate dependency sizes and counts for all packages using path data
const calculateDependencySizes = (packages: InstalledPackage[]): void => {
	// Build children map: parent name@version -> child packages
	const childrenMap = new Map<string, InstalledPackage[]>();

	for (const pkg of packages) {
		if (pkg.installedBy.length > 0) {
			// Immediate parent is the last element in installedBy
			const parent = pkg.installedBy.at(-1)!;
			const key = packageKey(parent.name, parent.version);
			if (!childrenMap.has(key)) {
				childrenMap.set(key, []);
			}
			childrenMap.get(key)!.push(pkg);
		}
	}

	// Memoize calculated stats to avoid O(N^2) recalculation
	const memo = new Map<string, DependencyStats>();

	// Recursively calculate dependency size and count with memoization
	const calculateStats = (
		key: string,
		visited: Set<string>,
	): DependencyStats => {
		// Check memo first
		const cached = memo.get(key);
		if (cached) {
			return cached;
		}

		// Prevent cycles
		if (visited.has(key)) {
			return {
				size: 0,
				count: 0,
			};
		}
		visited.add(key);

		const children = childrenMap.get(key);
		if (!children || children.length === 0) {
			const result = {
				size: 0,
				count: 0,
			};
			memo.set(key, result);
			return result;
		}

		let totalSize = 0;
		let totalCount = 0;
		for (const child of children) {
			totalSize += child.size;
			totalCount += 1;
			const childKey = packageKey(child.name, child.version);
			const childStats = calculateStats(childKey, visited);
			totalSize += childStats.size;
			totalCount += childStats.count;
		}

		const result = {
			size: totalSize,
			count: totalCount,
		};
		memo.set(key, result);
		return result;
	};

	// Set dependencySize and dependencyCount for each package
	for (const pkg of packages) {
		const key = packageKey(pkg.name, pkg.version);
		const stats = calculateStats(key, new Set());
		pkg.dependencySize = stats.size;
		pkg.dependencyCount = stats.count;
	}
};

// Check if any package has nested node_modules (indicates npm nested install)
const hasNestedNodeModules = async (nodeModulesPath: string): Promise<boolean> => {
	const entries = await fsp.readdir(nodeModulesPath, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) {
			continue;
		}

		// Check scoped packages (@scope/name)
		if (entry.name.startsWith('@')) {
			const scopePath = path.join(nodeModulesPath, entry.name);
			const scopedEntries = await fsp.readdir(scopePath, { withFileTypes: true });
			for (const scopedEntry of scopedEntries) {
				if (scopedEntry.isDirectory()) {
					const nestedPath = path.join(scopePath, scopedEntry.name, 'node_modules');
					if (await fsExists(nestedPath)) {
						return true;
					}
				}
			}
		} else {
			// Check regular packages
			const nestedPath = path.join(nodeModulesPath, entry.name, 'node_modules');
			if (await fsExists(nestedPath)) {
				return true;
			}
		}
	}

	return false;
};

export const getNodeModulesPackages = async (
	nodeModulesPath: string,
	packageManager?: string,
	verbose?: boolean,
): Promise<InstalledPackage[]> => {
	const exists = await fsExists(nodeModulesPath);
	if (!exists) {
		return [];
	}

	// Derive install directory from node_modules path for lockfile parsing
	const installDirectory = path.dirname(nodeModulesPath);

	let packages: InstalledPackage[];

	// If package manager is known, use the appropriate strategy
	if (packageManager === 'npm') {
		// npm uses flat/hoisted install by default, parse package-lock.json for paths
		packages = await getFlatPackages(nodeModulesPath, installDirectory, verbose);
	} else if (packageManager === 'pnpm') {
		const pnpmPath = path.join(nodeModulesPath, '.pnpm');
		packages = await getPnpmPackages(pnpmPath);
	} else {
		// For yarn or unknown, check filesystem structure
		const pnpmPath = path.join(nodeModulesPath, '.pnpm');
		const isPnpm = await fsExists(pnpmPath);

		if (isPnpm) {
			packages = await getPnpmPackages(pnpmPath);
		} else {
			// Check for nested node_modules (npm nested strategy)
			const hasNested = await hasNestedNodeModules(nodeModulesPath);

			packages = hasNested
				? await getNpmNestedPackages(nodeModulesPath)
				: await getFlatPackages(nodeModulesPath, installDirectory, verbose);
		}
	}

	// Calculate dependency sizes for all packages
	calculateDependencySizes(packages);

	return packages;
};

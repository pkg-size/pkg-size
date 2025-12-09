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

// Calculate dependency sizes and counts for all packages using path data
const calculateDependencySizes = (packages: InstalledPackage[]): void => {
	// Build children map: parent name -> child packages
	const childrenMap = new Map<string, InstalledPackage[]>();

	for (const pkg of packages) {
		if (pkg.path.length > 0) {
			// Immediate parent is the last element in path
			const parent = pkg.path.at(-1)!.name;
			if (!childrenMap.has(parent)) {
				childrenMap.set(parent, []);
			}
			childrenMap.get(parent)!.push(pkg);
		}
	}

	// Memoize calculated stats to avoid O(N^2) recalculation
	const memo = new Map<string, DependencyStats>();

	// Recursively calculate dependency size and count with memoization
	const calculateStats = (
		packageName: string,
		visited: Set<string>,
	): DependencyStats => {
		// Check memo first
		const cached = memo.get(packageName);
		if (cached) {
			return cached;
		}

		// Prevent cycles
		if (visited.has(packageName)) {
			return {
				size: 0,
				count: 0,
			};
		}
		visited.add(packageName);

		const children = childrenMap.get(packageName);
		if (!children || children.length === 0) {
			const result = {
				size: 0,
				count: 0,
			};
			memo.set(packageName, result);
			return result;
		}

		let totalSize = 0;
		let totalCount = 0;
		for (const child of children) {
			totalSize += child.size;
			totalCount += 1;
			const childStats = calculateStats(child.name, visited);
			totalSize += childStats.size;
			totalCount += childStats.count;
		}

		const result = {
			size: totalSize,
			count: totalCount,
		};
		memo.set(packageName, result);
		return result;
	};

	// Set dependencySize and dependencyCount for each package
	for (const pkg of packages) {
		const stats = calculateStats(pkg.name, new Set());
		pkg.dependencySize = stats.size;
		pkg.dependencyCount = stats.count;
	}
};

export const getNodeModulesPackages = async (
	nodeModulesPath: string,
	packageManager?: string,
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
		packages = await getFlatPackages(nodeModulesPath, installDirectory);
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
			const entries = await fsp.readdir(nodeModulesPath, { withFileTypes: true });
			let hasNested = false;
			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('@')) {
					const nestedPath = path.join(nodeModulesPath, entry.name, 'node_modules');
					hasNested = await fsExists(nestedPath);
					break; // Only check first package
				}
			}

			packages = hasNested
				? await getNpmNestedPackages(nodeModulesPath)
				: await getFlatPackages(nodeModulesPath, installDirectory);
		}
	}

	// Calculate dependency sizes for all packages
	calculateDependencySizes(packages);

	return packages;
};

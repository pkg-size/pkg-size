import path from 'node:path';
import type { InstalledPackage } from '../types.js';
import { crawlNodeModulesOnce } from '../utils/scanner.js';
import { getPackageMetadata } from '../utils/metadata.js';
import { parseLockfile, buildDependencyPathFromGraph } from '../utils/lockfile.js';

// Get packages from flat node_modules (yarn or npm hoisted)
// Uses single-crawl optimization: O(DiskLatency + Packages) instead of O(Packages * DiskLatency)
// Parses lockfile (npm/yarn/pnpm) to build dependency paths for verbose mode
export const getFlatPackages = async (
	nodeModulesPath: string,
	installDirectory?: string,
	verbose?: boolean,
): Promise<InstalledPackage[]> => {
	// Crawl entire node_modules once and bucket files by package
	const packageSizes = await crawlNodeModulesOnce(nodeModulesPath);

	// Only parse lockfile for dependency graph when verbose mode is enabled
	// Lockfile parsing can be expensive on large monorepos (50MB+ lockfiles)
	const graph = (verbose && installDirectory)
		? await parseLockfile(installDirectory)
		: undefined;

	// Build package list with metadata
	const packages: InstalledPackage[] = [];

	for (const [packageName, { size, files }] of packageSizes) {
		const packagePath = path.join(nodeModulesPath, packageName);
		const metadata = await getPackageMetadata(packagePath);

		// Build dependency path from lockfile graph if available
		const depPath = graph
			? buildDependencyPathFromGraph(packageName, graph)
			: [];

		packages.push({
			name: packageName,
			size,
			files,
			installedBy: depPath,
			get level() { return this.installedBy.length; },
			path: `node_modules/${packageName}`,
			dependencySize: 0,
			dependencyCount: 0,
			...metadata,
		});
	}

	return packages;
};

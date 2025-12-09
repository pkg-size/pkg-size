import path from 'node:path';
import type { InstalledPackage, PackageReference } from '../types.js';
import { crawlNodeModulesOnce, getPackageMetadata } from '../package-utils.js';
import { parseLockfile, buildDependencyPathFromGraph } from '../lockfile-parser.js';

// Get packages from flat node_modules (yarn or npm hoisted)
// Uses single-crawl optimization: O(DiskLatency + Packages) instead of O(Packages * DiskLatency)
// Parses lockfile (npm/yarn/pnpm) to build dependency paths for verbose mode
export const getFlatPackages = async (
	nodeModulesPath: string,
	installDirectory?: string,
): Promise<InstalledPackage[]> => {
	// Crawl entire node_modules once and bucket files by package
	const packageSizes = await crawlNodeModulesOnce(nodeModulesPath);

	// Try to parse lockfile for dependency graph
	const graph = installDirectory
		? await parseLockfile(installDirectory)
		: undefined;

	// Build package list with metadata
	const packages: InstalledPackage[] = [];

	for (const [packageName, { size, files }] of packageSizes) {
		const packagePath = path.join(nodeModulesPath, packageName);
		const metadata = await getPackageMetadata(packagePath);

		// Build dependency path from lockfile graph if available
		const { path: depPath, additionalParentCount } = graph
			? buildDependencyPathFromGraph(packageName, graph)
			: {
				path: [] as PackageReference[],
				additionalParentCount: 0,
			};

		packages.push({
			name: packageName,
			size,
			files,
			path: depPath,
			additionalParentCount,
			dependencySize: 0,
			dependencyCount: 0,
			...metadata,
		});
	}

	return packages;
};

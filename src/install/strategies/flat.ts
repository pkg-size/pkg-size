import fsp from 'node:fs/promises';
import path from 'node:path';
import type { InstalledPackage } from '../types.js';
import { getDirectorySizeExcludingNodeModules, getPackageMetadata } from '../package-utils.js';

// Collect packages from a directory without recursion (for flat/hoisted structures)
const collectPackagesFlat = async (
	directory: string,
	packages: InstalledPackage[],
): Promise<void> => {
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
					const [{ size, files }, metadata] = await Promise.all([
						getDirectorySizeExcludingNodeModules(scopedPath),
						getPackageMetadata(scopedPath),
					]);
					packages.push({
						name: `${entry.name}/${scopedEntry.name}`,
						size,
						files,
						path: [],
						additionalParentCount: 0,
						dependencySize: 0,
						dependencyCount: 0,
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
				additionalParentCount: 0,
				dependencySize: 0,
				dependencyCount: 0,
				...metadata,
			});
		}
	}
};

// Get packages from flat node_modules (yarn or npm hoisted)
export const getFlatPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectPackagesFlat(nodeModulesPath, packages);
	return packages;
};

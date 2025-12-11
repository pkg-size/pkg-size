import fsp from 'node:fs/promises';
import path from 'node:path';
import { fsExists } from '../../utils/fs-exists.js';
import type { InstalledPackage, PackageReference } from '../types.js';
import { getDirectorySizeExcludingNodeModules } from '../utils/scanner.js';
import { getPackageMetadata } from '../utils/metadata.js';

// Recursively collect packages from nested node_modules (npm --install-strategy=nested)
const collectNestedPackages = async (
	directory: string,
	packages: InstalledPackage[],
	parentPath: PackageReference[],
	pathPrefix: string,
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
						installedBy: parentPath,
						path: `${pathPrefix}/${packageName}`,
						dependencySize: 0,
						dependencyCount: 0,
						...metadata,
					};
					packages.push(pkg);

					// Recursively check for nested node_modules
					const nestedNodeModules = path.join(scopedPath, 'node_modules');
					const currentRef: PackageReference = {
						name: packageName,
						version: metadata.version,
					};
					await collectNestedPackages(
						nestedNodeModules,
						packages,
						[...parentPath, currentRef],
						`${pathPrefix}/${packageName}/node_modules`,
					);
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
				installedBy: parentPath,
				path: `${pathPrefix}/${entry.name}`,
				dependencySize: 0,
				dependencyCount: 0,
				...metadata,
			};
			packages.push(pkg);

			// Recursively check for nested node_modules
			const nestedNodeModules = path.join(fullPath, 'node_modules');
			const currentRef: PackageReference = {
				name: entry.name,
				version: metadata.version,
			};
			await collectNestedPackages(
				nestedNodeModules,
				packages,
				[...parentPath, currentRef],
				`${pathPrefix}/${entry.name}/node_modules`,
			);
		}
	}
};

// Get packages from npm nested install (--install-strategy=nested)
export const getNpmNestedPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectNestedPackages(nodeModulesPath, packages, [], 'node_modules');
	return packages;
};

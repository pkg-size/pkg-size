import path from 'node:path';
import { getNodeModulesPackages } from './node-modules.js';
import type { InstalledPackage, NodeModulesAnalysis } from './types.js';

export const analyzeNodeModules = async (
	directory: string,
	packageManager?: string,
): Promise<NodeModulesAnalysis> => {
	const nodeModulesPath = path.join(directory, 'node_modules');
	const allPackages = await getNodeModulesPackages(nodeModulesPath, packageManager);

	// Deduplicate by name@version for accurate reporting
	// (nested npm installs create physical duplicates that wouldn't exist in hoisted installs)
	const seen = new Map<string, InstalledPackage>();
	for (const pkg of allPackages) {
		const key = `${pkg.name}@${pkg.version}`;
		if (!seen.has(key)) {
			seen.set(key, pkg);
		}
	}

	const packages = [...seen.values()];
	let totalSize = 0;
	for (const pkg of packages) {
		totalSize += pkg.size;
	}

	return {
		packages,
		totalSize,
	};
};

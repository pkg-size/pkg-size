import path from 'node:path';
import { getNodeModulesPackages } from './node-modules.js';
import type { NodeModulesAnalysis } from './types.js';

export const analyzeNodeModules = async (
	directory: string,
): Promise<NodeModulesAnalysis> => {
	const nodeModulesPath = path.join(directory, 'node_modules');
	const packages = await getNodeModulesPackages(nodeModulesPath);

	let totalSize = 0;
	for (const pkg of packages) {
		totalSize += pkg.size;
	}

	return {
		packages,
		totalSize,
	};
};

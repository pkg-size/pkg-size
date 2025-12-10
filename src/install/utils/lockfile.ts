import { findAndParseLockfile } from 'parse-lock-files';
import type { PackageReference } from '../types.js';

type DependencyGraph = Map<string, PackageReference[]>;

// Build a dependency graph from any lockfile (npm, yarn, pnpm)
// Uses parse-lock-files for cross-package-manager support
export const parseLockfile = async (
	installDirectory: string,
): Promise<DependencyGraph | undefined> => {
	try {
		const lockfile = await findAndParseLockfile(installDirectory);
		const graph: DependencyGraph = new Map();

		// Process each package entry
		for (const [packagePath, packageInfo] of Object.entries(lockfile.packages)) {
			if (!packageInfo.dependencies || Object.keys(packageInfo.dependencies).length === 0) {
				continue;
			}

			// Determine parent package name and version
			let parentName: string;
			let parentVersion: string;

			if (packagePath === '') {
				// Root package (package.json) - npm format
				parentName = '';
				parentVersion = '';
			} else if (packagePath.startsWith('node_modules/')) {
				// npm format: "node_modules/is-odd" or "node_modules/@scope/name"
				parentName = packagePath.slice('node_modules/'.length);
				parentVersion = packageInfo.version ?? '';
			} else {
				// pnpm/yarn format: various key formats
				// Skip complex keys we can't parse reliably
				continue;
			}

			// Add each dependency to the graph
			for (const depName of Object.keys(packageInfo.dependencies)) {
				const parents = graph.get(depName) || [];

				// Only add non-root parents to the path
				if (parentName) {
					parents.push({
						name: parentName,
						version: parentVersion,
					});
				}

				graph.set(depName, parents);
			}
		}

		return graph;
	} catch {
		return undefined;
	}
};

type DependencyPathResult = {
	path: PackageReference[];
	additionalParentCount: number;
};

// Build the full dependency path from root to a package
export const buildDependencyPathFromGraph = (
	packageName: string,
	graph: DependencyGraph,
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

	const parents = graph.get(packageName);
	if (!parents || parents.length === 0) {
		// Root package - no parent (direct dependency of package.json)
		return {
			path: [],
			additionalParentCount: 0,
		};
	}

	// Take first parent and recursively build its path
	const parent = parents[0];
	const parentResult = buildDependencyPathFromGraph(parent.name, graph, visited);

	return {
		path: [...parentResult.path, parent],
		additionalParentCount: parents.length - 1,
	};
};

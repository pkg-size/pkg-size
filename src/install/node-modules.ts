import fsp from 'node:fs/promises';
import path from 'node:path';
import { fdir as Fdir } from 'fdir';
import pMap from 'p-map';
import type { PackageJson } from 'type-fest';
import { fsExists } from '../utils/fs-exists.js';
import type {
	PackageFile,
	PackageReference,
	InstalledPackage,
	SizeResult,
} from './types.js';

type PackageMetadata = {
	version: string;
	license?: string;
	author?: string;
	repository?: string;
	homepage?: string;
	funding?: string;
};

const normalizeAuthor = (
	author: PackageJson.Person | undefined,
): string | undefined => {
	if (!author) {
		return undefined;
	}
	if (typeof author === 'string') {
		return author;
	}
	return author.email
		? `${author.name} <${author.email}>`
		: author.name;
};

// Handle legacy license formats: object { type, url } or array of objects
const normalizeLicense = (
	license: unknown,
	licenses: PackageJson['licenses'],
): string | undefined => {
	if (typeof license === 'string') {
		return license;
	}
	// Handle legacy object format: { type: "MIT", url: "..." }
	if (license && typeof license === 'object' && 'type' in license) {
		const licenseObject = license as { type?: string };
		if (typeof licenseObject.type === 'string') {
			return licenseObject.type;
		}
	}
	// Fall back to deprecated licenses array
	if (licenses && licenses.length > 0) {
		return licenses
			.map(l => l.type)
			.filter(Boolean)
			.join(', ') || undefined;
	}
	return undefined;
};

// Repository can be string or object { type, url }
const normalizeRepository = (
	repository: PackageJson['repository'],
): string | undefined => {
	if (!repository) {
		return undefined;
	}
	if (typeof repository === 'string') {
		// Handle shorthand like "github:user/repo"
		if (repository.startsWith('github:')) {
			return `https://github.com/${repository.slice(7)}`;
		}
		if (repository.startsWith('gitlab:')) {
			return `https://gitlab.com/${repository.slice(7)}`;
		}
		if (repository.startsWith('bitbucket:')) {
			return `https://bitbucket.org/${repository.slice(10)}`;
		}
		// Plain "user/repo" format typically means GitHub
		if (/^[\w-]+\/[\w-]+$/.test(repository)) {
			return `https://github.com/${repository}`;
		}
		return repository;
	}
	if (typeof repository.url === 'string') {
		let { url } = repository;
		// Convert git:// and git+https:// to https://
		url = url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://');
		// Remove .git suffix
		url = url.replace(/\.git$/, '');
		return url;
	}
	return undefined;
};

// Funding can be string, object { url }, or array
const normalizeFunding = (
	funding: PackageJson['funding'],
): string | undefined => {
	if (!funding) {
		return undefined;
	}
	if (typeof funding === 'string') {
		return funding;
	}
	if (Array.isArray(funding)) {
		// Take first funding URL
		const first = funding[0];
		if (typeof first === 'string') {
			return first;
		}
		if (first && typeof first.url === 'string') {
			return first.url;
		}
		return undefined;
	}
	if (typeof funding.url === 'string') {
		return funding.url;
	}
	return undefined;
};

const getPackageMetadata = async (
	packageDirectory: string,
): Promise<PackageMetadata> => {
	const packageJsonPath = path.join(packageDirectory, 'package.json');
	const exists = await fsExists(packageJsonPath);
	if (!exists) {
		return { version: '' };
	}

	try {
		const content = await fsp.readFile(packageJsonPath, 'utf8');
		const packageJson = JSON.parse(content) as PackageJson;
		return {
			version: packageJson.version ?? '',
			license: normalizeLicense(packageJson.license, packageJson.licenses),
			author: normalizeAuthor(packageJson.author),
			repository: normalizeRepository(packageJson.repository),
			homepage: packageJson.homepage,
			funding: normalizeFunding(packageJson.funding),
		};
	} catch {
		return { version: '' };
	}
};

// Concurrency limit to avoid EMFILE (too many open files)
const statConcurrency = 100;

const getDirectorySizeExcludingNodeModules = async (directory: string): Promise<SizeResult> => {
	const filePaths = await new Fdir()
		.withRelativePaths()
		.exclude((_directoryName, directoryPath) => directoryPath.includes('node_modules'))
		.crawl(directory)
		.withPromise();

	const files = await pMap(
		filePaths,
		async (relativePath): Promise<PackageFile> => {
			const stats = await fsp.stat(path.join(directory, relativePath));
			return {
				path: relativePath,
				size: stats.size,
			};
		},
		{ concurrency: statConcurrency },
	);

	let size = 0;
	for (const file of files) {
		size += file.size;
	}

	return {
		size,
		files,
	};
};

// Recursively collect packages from nested node_modules (npm --install-strategy=nested)
const collectNestedPackages = async (
	directory: string,
	packages: InstalledPackage[],
	parentPath: PackageReference[],
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
						path: parentPath,
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
					await collectNestedPackages(nestedNodeModules, packages, [...parentPath, currentRef]);
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
				path: parentPath,
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
			await collectNestedPackages(nestedNodeModules, packages, [...parentPath, currentRef]);
		}
	}
};

// Get packages from npm nested install (--install-strategy=nested)
const getNpmNestedPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectNestedPackages(nodeModulesPath, packages, []);
	return packages;
};

// Collect packages from a directory without recursion (for pnpm/flat structures)
const collectPackagesFlat = async (
	directory: string,
	packages: InstalledPackage[],
	skipHidden = false,
): Promise<void> => {
	const entries = await fsp.readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		// Skip hidden folders when requested
		if (skipHidden && entry.name.startsWith('.')) {
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
				dependencySize: 0,
				dependencyCount: 0,
				...metadata,
			});
		}
	}
};

// Parse pnpm directory name to extract package name and version
// Format: {name}@{version} or @{scope}+{name}@{version}
// Can include peer dep info: {name}@{version}_{peer-deps}
// Example: nx@21.6.4_@swc-node+register@1.9.2_@swc+core@1.12.11
const parsePnpmDirName = (
	dirName: string,
): PackageReference | undefined => {
	// Find the @ that starts the version (followed by a digit)
	// This distinguishes the version @ from scoped package @ and peer dep @
	let atIndex = -1;

	for (let i = 1; i < dirName.length - 1; i += 1) {
		if (dirName[i] === '@' && /\d/.test(dirName[i + 1])) {
			atIndex = i;
			break;
		}
	}

	if (atIndex === -1) {
		return undefined;
	}

	const nameWithPlus = dirName.slice(0, atIndex);
	let version = dirName.slice(atIndex + 1);

	// Remove peer dep info (everything after first _)
	const underscoreIndex = version.indexOf('_');
	if (underscoreIndex !== -1) {
		version = version.slice(0, underscoreIndex);
	}

	// Convert @scope+name to @scope/name for scoped packages
	const name = nameWithPlus.replace('+', '/');

	return {
		name,
		version,
	};
};

// Recursively build the full dependency path from root to a package
const buildDependencyPath = (
	packageName: string,
	dependencyMap: Map<string, PackageReference[]>,
	visited: Set<string> = new Set(),
): PackageReference[] => {
	// Prevent cycles
	if (visited.has(packageName)) {
		return [];
	}
	visited.add(packageName);

	const parents = dependencyMap.get(packageName);
	if (!parents || parents.length === 0) {
		// Root package - no parent
		return [];
	}

	// Take first parent and recursively build its path
	const parent = parents[0];
	const parentPath = buildDependencyPath(parent.name, dependencyMap, visited);

	return [...parentPath, parent];
};

// Get packages from pnpm's .pnpm directory (content-addressable store)
// Build dependency paths by analyzing symlinks in each package's node_modules
const getPnpmPackages = async (
	pnpmPath: string,
): Promise<InstalledPackage[]> => {
	const exists = await fsExists(pnpmPath);
	if (!exists) {
		return [];
	}

	const entries = await fsp.readdir(pnpmPath, { withFileTypes: true });

	// First pass: build a map of which packages depend on which
	// Key: package name, Value: array of parent packages that depend on it
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

	// Second pass: collect packages with their paths
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
						const dependencyPath = buildDependencyPath(packageName, dependencyMap);

						packages.push({
							name: packageName,
							size,
							files,
							path: dependencyPath,
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
				const dependencyPath = buildDependencyPath(innerEntry.name, dependencyMap);

				packages.push({
					name: innerEntry.name,
					size,
					files,
					path: dependencyPath,
					dependencySize: 0,
					dependencyCount: 0,
					...metadata,
				});
			}
		}
	}

	return packages;
};

// Get packages from flat node_modules (yarn or npm hoisted)
const getFlatPackages = async (
	nodeModulesPath: string,
): Promise<InstalledPackage[]> => {
	const packages: InstalledPackage[] = [];
	await collectPackagesFlat(nodeModulesPath, packages, true);
	return packages;
};

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

	// Recursively calculate dependency size and count with deduplication
	const calculateStats = (
		packageName: string,
		visited: Set<string>,
	): DependencyStats => {
		if (visited.has(packageName)) {
			return {
				size: 0,
				count: 0,
			};
		}
		visited.add(packageName);

		const children = childrenMap.get(packageName);
		if (!children || children.length === 0) {
			return {
				size: 0,
				count: 0,
			};
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
		return {
			size: totalSize,
			count: totalCount,
		};
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

	let packages: InstalledPackage[];

	// If package manager is known, use the appropriate strategy
	if (packageManager === 'npm') {
		packages = await getNpmNestedPackages(nodeModulesPath);
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
				: await getFlatPackages(nodeModulesPath);
		}
	}

	// Calculate dependency sizes for all packages
	calculateDependencySizes(packages);

	return packages;
};

import byteSize from 'byte-size';
import ansis, {
	green, bold, dim, yellow,
	underline,
} from 'ansis';
import terminalLink from 'terminal-link';
import type { InstalledPackage } from '../../install/types.js';
import { comparePackages, type GroupBy, type PackageGroup } from '../../utils/grouping.js';
import { parseAuthor } from '../../utils/parse-author.js';
import { printRows } from './table.js';

const orange = ansis.hex('#FFAA30');
const amberEarth = ansis.hex('#E57C04');

const formatSize = (bytes: number): string => byteSize(bytes).toString();

const formatAuthor = (author: string): string | null => {
	const parsed = parseAuthor(author);
	if (!parsed) {
		return null;
	}
	if (parsed.url) {
		return terminalLink(parsed.name, parsed.url);
	}
	return parsed.name;
};

const formatEmojiLinks = (pkg: InstalledPackage): string => {
	// 📦 unpkg.com (always present)
	const links = [
		(terminalLink('📦', `https://unpkg.com/browse/${pkg.name}@${pkg.version}/`)),
	];

	// 😺 GitHub repo
	if (pkg.repository) {
		links.push((terminalLink('😺', pkg.repository)));
	}

	// 🌐 Homepage
	if (pkg.homepage) {
		links.push((terminalLink('🌐', pkg.homepage)));
	}

	// ♥️ Funding
	if (pkg.funding) {
		links.push((terminalLink('♥️', pkg.funding)));
	}

	return links.join(' ');
};

const formatDependencyInfo = (pkg: InstalledPackage): string => {
	if (pkg.dependencyCount === 0) {
		return `${bold('Dependencies:')} ${dim('0')}`;
	}
	return `${bold('Dependencies:')} ${dim(`${pkg.dependencyCount} (${formatSize(pkg.dependencySize)})`)}`;
};

const formatPackageRef = (name: string, version: string): string => {
	const nameWithVersion = orange(name + (version ? ` v${version}` : ''));
	return terminalLink(nameWithVersion, `https://www.npmjs.com/package/${name}/v/${version}`);
};

const formatPath = (
	pkg: InstalledPackage,
): string => {
	const parts: string[] = [];

	for (const parent of pkg.path) {
		parts.push(`${parent.name} v${parent.version}`);
	}

	return parts.join(' → ');
};

const formatPackageName = (
	pkg: InstalledPackage,
	verbose = false,
): string => {
	const base = formatPackageRef(pkg.name, pkg.version);
	if (!verbose) {
		return base;
	}

	const parts = [base];
	if (pkg.author) {
		const formattedAuthor = formatAuthor(pkg.author);
		if (formattedAuthor) {
			parts.push(`${dim('by')} ${formattedAuthor}`);
		}
	}
	if (pkg.license) {
		parts.push(yellow(pkg.license));
	}
	parts.push('| ' + (formatEmojiLinks(pkg)));
	return parts.join(' ');
};

const formatGroupedPath = (
	pkg: InstalledPackage,
	groupKey: string,
	groupBy: GroupBy,
): string => {
	const getDisplayName = (name: string): string => (
		groupBy === 'scope' && name.startsWith('@')
			? name.slice(groupKey.length + 1)
			: name
	);

	const parts: string[] = [];

	for (const parent of pkg.path) {
		parts.push(formatPackageRef(getDisplayName(parent.name), parent.version));
	}

	return parts.join(' → ');
};

const formatGroupedPackageName = (
	pkg: InstalledPackage,
	groupKey: string,
	groupBy: GroupBy,
	verbose = false,
): string => {
	const displayName = groupBy === 'scope' && pkg.name.startsWith('@')
		? pkg.name.slice(groupKey.length + 1)
		: pkg.name;

	const base = formatPackageRef(displayName, pkg.version);
	if (!verbose) {
		return `  ${base}`;
	}

	const parts = [base];
	if (pkg.author) {
		const formattedAuthor = formatAuthor(pkg.author);
		if (formattedAuthor) {
			parts.push(`${dim('by')} ${formattedAuthor}`);
		}
	}
	if (pkg.license) {
		parts.push(yellow(pkg.license));
	}
	parts.push(formatEmojiLinks(pkg));
	return `  ${parts.join(' ')}`;
};

type RenderOptions = {
	statusMessage?: string;
	verbose?: boolean;
};

const formatPercentage = (size: number, totalSize: number): string => {
	const percentage = (size / totalSize) * 100;

	// ≥ 1% → no decimals
	if (percentage >= 1) {
		return `${Math.round(percentage)}%`;
	}

	// 0.1% to 0.9%
	if (percentage >= 0.05) {
		return `${Number(percentage.toFixed(1))}%`;
	}

	// 0.01% to 0.04%
	if (percentage >= 0.005) {
		return `${Number(percentage.toFixed(2))}%`;
	}

	// Truly tiny
	if (percentage > 0) {
		return '<0.01%';
	}

	return '0%';
};


export const renderPackagesTable = (
	packages: InstalledPackage[],
	totalSize: number,
	options: RenderOptions = {},
): void => {
	if (options.statusMessage) {
		console.log(dim(options.statusMessage));
	}
	console.log('');

	const rows: string[][] = [];

	// Header with total size and package count
	const packageCount = packages.length.toLocaleString();
	const packageLabel = packages.length === 1 ? 'Package' : 'Packages';
	rows.push(
		[
			underline(bold(amberEarth(formatSize(totalSize)))),
			underline(bold(amberEarth(`${packageCount} ${packageLabel}`))),
		],
		['', ''],
	);

	for (let i = 0; i < packages.length; i += 1) {
		const pkg = packages[i];

		// Empty line above each package only in verbose mode (skip first)
		if (options.verbose && i > 0) {
			rows.push(['', '']);
		}

		rows.push([
			options.verbose
				? bold(formatPercentage(pkg.size, totalSize))
				: formatSize(pkg.size),
			formatPackageName(pkg, options.verbose),
		]);

		// Show size and path underneath package when verbose
		if (options.verbose) {
			const pathPart = pkg.path.length > 0
				? `${bold('Installed by:')} ${dim(formatPath(pkg))}`
				: `${bold('Installed by:')} ${dim('package.json')}`;
			rows.push([formatSize(pkg.size), pathPart]);
		}

		// Show dependency info underneath package when verbose
		if (options.verbose) {
			rows.push(['', formatDependencyInfo(pkg)]);
		}
	}

	printRows(rows, { align: ['right', 'left'] });
	console.log('');
};

export const renderGroupedPackagesTable = (
	groups: Record<string, PackageGroup>,
	totalSize: number,
	groupBy: GroupBy,
	sortProperty: string,
	options: RenderOptions = {},
): void => {
	if (options.statusMessage) {
		console.log(dim(options.statusMessage));
	}
	console.log('');

	const rows: string[][] = [];

	// Count total packages across all groups
	let totalPackages = 0;
	for (const groupData of Object.values(groups)) {
		totalPackages += groupData.packages.length;
	}

	// Header with total size and package count
	const packageCount = totalPackages.toLocaleString();
	const packageLabel = totalPackages === 1 ? 'Package' : 'Packages';
	rows.push([green(formatSize(totalSize)), green(`${packageCount} ${packageLabel}`)], ['', '']);

	// Sort groups by total size descending
	const sortedGroups = Object.entries(groups).sort(
		([, a], [, b]) => b.totalSize - a.totalSize,
	);

	for (const [groupKey, groupData] of sortedGroups) {
		// Group header
		rows.push([dim(formatPercentage(groupData.totalSize, totalSize)), bold(groupKey)]);

		// Sort packages within group
		groupData.packages.sort(comparePackages(sortProperty));

		for (let i = 0; i < groupData.packages.length; i += 1) {
			const pkg = groupData.packages[i];

			// Empty line above each package only in verbose mode (skip first)
			if (options.verbose && i > 0) {
				rows.push(['', '']);
			}

			rows.push([
				options.verbose
					? formatPercentage(pkg.size, totalSize)
					: formatSize(pkg.size),
				formatGroupedPackageName(pkg, groupKey, groupBy, options.verbose),
			]);

			// Show size and path underneath package when verbose
			if (options.verbose) {
				const pathPart = pkg.path.length > 0
					? `  ${bold('Installed by:')} ${formatGroupedPath(pkg, groupKey, groupBy)}`
					: `  ${bold('Installed by:')} ${dim('package.json')}`;
				rows.push([formatSize(pkg.size), pathPart]);
			}

			// Show dependency info underneath package when verbose
			if (options.verbose) {
				rows.push(['', `  ${formatDependencyInfo(pkg)}`]);
			}
		}

		// Empty row after each group
		rows.push(['', '']);
	}

	printRows(rows, { align: ['right', 'left'] });
	console.log('');
};

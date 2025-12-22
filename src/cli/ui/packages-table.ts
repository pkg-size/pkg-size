import {
	green, bold, dim, yellow,
	underline,
} from 'ansis';
import terminalLink from 'terminal-link';
import type { InstalledPackage } from '../../install/types.js';
import type { GroupBy, PackageGroup } from '../../utils/grouping.js';
import { comparePackages, type SortCriteria } from '../../utils/sorting.js';
import { parseAuthor } from '../../utils/parse-author.js';
import { orange, amberEarth } from './colors.js';
import { formatSize } from './format.js';
import { printRows } from './table.js';

// Link icons (extracted for potential --no-emoji mode support)
const LINK_ICONS = {
	unpkg: '📦',
	repository: '😺',
	homepage: '🌐',
	funding: '♥️',
} as const;

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
	// unpkg.com (always present)
	const links = [
		terminalLink(LINK_ICONS.unpkg, `https://unpkg.com/browse/${pkg.name}@${pkg.version}/`),
	];

	// GitHub repo
	if (pkg.repository) {
		links.push(terminalLink(LINK_ICONS.repository, pkg.repository));
	}

	// Homepage
	if (pkg.homepage) {
		links.push(terminalLink(LINK_ICONS.homepage, pkg.homepage));
	}

	// Funding
	if (pkg.funding) {
		links.push(terminalLink(LINK_ICONS.funding, pkg.funding));
	}

	return links.join(' ');
};

const formatDependencyInfo = (pkg: InstalledPackage): string => {
	if (pkg.dependencyCount === 0) {
		return `${bold('Dependencies:')} ${dim('0')}`;
	}
	return `${bold('Dependencies:')} ${dim(`${pkg.dependencyCount} (${formatSize(pkg.dependencySize)})`)}`;
};

// Version may not exist for symlinked packages or manually edited package.json
const formatNameVersion = (name: string, version: string): string => (
	version ? `${name} v${version}` : name
);

const formatPackageRef = (name: string, version: string): string => terminalLink(
	orange(formatNameVersion(name, version)),
	`https://www.npmjs.com/package/${name}/v/${version}`,
);

const formatInstalledBy = (
	pkg: InstalledPackage,
): string => pkg.installedBy
	.map(parent => formatNameVersion(parent.name, parent.version))
	.join(' → ');

const formatPackageName = (
	pkg: InstalledPackage,
	verbose = false,
	indent = '',
): string => {
	const base = formatPackageRef(pkg.name, pkg.version);
	if (!verbose) {
		return `${indent}${base} ${dim(pkg.path)}`;
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
	parts.push(`| ${formatEmojiLinks(pkg)}`);
	return `${indent}${parts.join(' ')}`;
};

const formatVerboseDetails = (pkg: InstalledPackage, indent = ''): string[][] => {
	const installedByPart = pkg.installedBy.length > 0
		? `${indent}${bold('Installed by:')} ${dim(formatInstalledBy(pkg))}`
		: `${indent}${bold('Installed by:')} ${dim('package.json')}`;
	return [
		[formatSize(pkg.size), `${indent}${dim(pkg.path)}`],
		['', installedByPart],
		['', `${indent}${formatDependencyInfo(pkg)}`],
	];
};

type RenderOptions = {
	statusMessage?: string;
	verbose?: boolean;
};

const formatPercentage = (size: number, totalSize: number): string => {
	if (totalSize === 0) {
		return '0%';
	}

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
			underline((amberEarth(formatSize(totalSize)))),
			underline((amberEarth(`${packageCount} ${packageLabel}`))),
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

		if (options.verbose) {
			rows.push(...formatVerboseDetails(pkg));
		}
	}

	printRows(rows, { align: ['right', 'left'] });
	console.log('');
};

export const renderGroupedPackagesTable = (
	groups: Record<string, PackageGroup>,
	totalSize: number,
	sortCriteria: SortCriteria,
	groupBy: GroupBy,
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
		// Group header - format as author name when grouping by author
		const groupLabel = groupBy === 'author'
			? (formatAuthor(groupKey) ?? groupKey)
			: groupKey;
		rows.push([
			underline(bold(formatPercentage(groupData.totalSize, totalSize))),
			underline(bold(groupLabel)),
		]);

		// Sort packages within group
		groupData.packages.sort(comparePackages(sortCriteria));

		const indent = '  ';
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
				formatPackageName(pkg, options.verbose, indent),
			]);

			if (options.verbose) {
				rows.push(...formatVerboseDetails(pkg, indent));
			}
		}

		// Empty row after each group
		rows.push(['', '']);
	}

	printRows(rows, { align: ['right', 'left'] });
	console.log('');
};

import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim, yellow,
} from 'yoctocolors';
import type { InstalledPackage } from '../../install/types.js';
import { comparePackages, type GroupBy, type PackageGroup } from '../../utils/grouping.js';

const formatSize = (bytes: number): string => byteSize(bytes).toString();

const formatPackageRef = (name: string, version: string): string => {
	const versionSuffix = version ? ` ${dim(version)}` : '';
	return `${cyan(name)}${versionSuffix}`;
};

const formatPath = (
	pkg: InstalledPackage,
): string => {
	const parts: string[] = [];

	for (const parent of pkg.path) {
		parts.push(formatPackageRef(parent.name, parent.version));
	}

	return `${parts.join(' → ')} ↴`;
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
		parts.push(`${dim('by')} ${pkg.author}`);
	}
	if (pkg.license) {
		parts.push(yellow(pkg.license));
	}
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

	return `  ${parts.join(' → ')} ↴`;
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
		parts.push(`${dim('by')} ${pkg.author}`);
	}
	if (pkg.license) {
		parts.push(yellow(pkg.license));
	}
	return `  ${parts.join(' ')}`;
};

type RenderOptions = {
	statusMessage?: string;
	verbose?: boolean;
};

const createTable = (): SimpleTable => {
	const table = new SimpleTable();
	table.header(
		{
			text: green('Package'),
			maxWidth: Infinity,
		},
		{
			text: green('Size'),
			align: 'right' as const,
		},
	);
	return table;
};

const printTable = (
	table: SimpleTable,
	totalSize: number,
	options: RenderOptions,
): void => {
	if (options.statusMessage) {
		console.log(dim(options.statusMessage));
	}
	console.log('');

	table.row();
	table.row(
		bold('Total'),
		underline(formatSize(totalSize)),
	);

	console.log(`${table.toString()}\n`);
};

export const renderPackagesTable = (
	packages: InstalledPackage[],
	totalSize: number,
	options: RenderOptions = {},
): void => {
	const table = createTable();

	for (let i = 0; i < packages.length; i += 1) {
		const pkg = packages[i];

		// Empty line above each package only in verbose mode (skip first)
		if (options.verbose && i > 0) {
			table.row();
		}

		// Show path on separate dimmed line above package when verbose
		if (options.verbose && pkg.path.length > 0) {
			table.row(dim(formatPath(pkg)));
		}

		table.row(
			formatPackageName(pkg, options.verbose),
			formatSize(pkg.size),
		);
	}

	printTable(table, totalSize, options);
};

export const renderGroupedPackagesTable = (
	groups: Record<string, PackageGroup>,
	totalSize: number,
	groupBy: GroupBy,
	sortProperty: string,
	options: RenderOptions = {},
): void => {
	const table = createTable();

	// Sort groups by total size descending
	const sortedGroups = Object.entries(groups).sort(
		([, a], [, b]) => b.totalSize - a.totalSize,
	);

	for (const [groupKey, groupData] of sortedGroups) {
		// Group header
		table.row(bold(groupKey), dim(formatSize(groupData.totalSize)));

		// Sort packages within group
		groupData.packages.sort(comparePackages(sortProperty));

		for (let i = 0; i < groupData.packages.length; i += 1) {
			const pkg = groupData.packages[i];

			// Empty line above each package only in verbose mode (skip first)
			if (options.verbose && i > 0) {
				table.row();
			}

			// Show path on separate dimmed line above package when verbose
			if (options.verbose && pkg.path.length > 0) {
				table.row(dim(formatGroupedPath(pkg, groupKey, groupBy)));
			}

			table.row(
				formatGroupedPackageName(pkg, groupKey, groupBy, options.verbose),
				formatSize(pkg.size),
			);
		}

		// Empty row after each group
		table.row();
	}

	printTable(table, totalSize, options);
};

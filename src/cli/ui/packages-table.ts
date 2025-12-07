import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import type { InstalledPackage } from '../../install/types.js';
import { comparePackages, type GroupBy, type PackageGroup } from '../../utils/grouping.js';

const formatSize = (bytes: number): string => byteSize(bytes).toString();

const formatPackageName = (
	pkg: InstalledPackage,
): string => {
	const versionSuffix = pkg.version ? ` ${dim(pkg.version)}` : '';
	return `${cyan(pkg.name)}${versionSuffix}`;
};

const formatGroupedPackageName = (
	pkg: InstalledPackage,
	groupKey: string,
	groupBy: GroupBy,
): string => {
	// For scope grouping, show shortened names for scoped packages
	const displayName = groupBy === 'scope' && pkg.name.startsWith('@')
		? pkg.name.slice(groupKey.length + 1)
		: pkg.name;
	const versionSuffix = pkg.version ? ` ${dim(pkg.version)}` : '';
	return `  ${cyan(displayName)}${versionSuffix}`;
};

type RenderOptions = {
	statusMessage?: string;
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

	const table = new SimpleTable();

	table.header(
		green('Package'),
		{
			text: green('Size'),
			align: 'right' as const,
		},
	);

	for (const pkg of packages) {
		table.row(
			formatPackageName(pkg),
			formatSize(pkg.size),
		);
	}

	table.row();
	table.row(
		bold('Total'),
		underline(formatSize(totalSize)),
	);

	console.log(`${table.toString()}\n`);
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

	const table = new SimpleTable();

	table.header(
		green('Package'),
		{
			text: green('Size'),
			align: 'right' as const,
		},
	);

	// Sort groups by total size descending
	const sortedGroups = Object.entries(groups).sort(
		([, a], [, b]) => b.totalSize - a.totalSize,
	);

	for (const [groupKey, groupData] of sortedGroups) {
		// Group header
		table.row(bold(groupKey), dim(formatSize(groupData.totalSize)));

		// Sort packages within group
		groupData.packages.sort(comparePackages(sortProperty));

		for (const pkg of groupData.packages) {
			table.row(
				formatGroupedPackageName(pkg, groupKey, groupBy),
				formatSize(pkg.size),
			);
		}

		// Empty row after each group
		table.row();
	}

	table.row(
		bold('Total'),
		underline(formatSize(totalSize)),
	);

	console.log(`${table.toString()}\n`);
};

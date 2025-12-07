import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import type { InstalledPackage } from '../../install/types.js';
import { comparePackages, type GroupBy, type PackageGroup } from '../../utils/grouping.js';

const formatSize = (bytes: number): string => byteSize(bytes).toString();

const formatPackageRef = (name: string, version: string): string => {
	const versionSuffix = version ? ` ${dim(version)}` : '';
	return `${cyan(name)}${versionSuffix}`;
};

const formatPackageName = (
	pkg: InstalledPackage,
): string => {
	const parts: string[] = [];

	// Add parent packages from path
	for (const parent of pkg.path) {
		parts.push(formatPackageRef(parent.name, parent.version));
	}

	// Add the package itself
	parts.push(formatPackageRef(pkg.name, pkg.version));

	return parts.join(' → ');
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

	const parts: string[] = [];

	// Add parent packages from path
	for (const parent of pkg.path) {
		const parentDisplayName = groupBy === 'scope' && parent.name.startsWith('@')
			? parent.name.slice(groupKey.length + 1)
			: parent.name;
		parts.push(formatPackageRef(parentDisplayName, parent.version));
	}

	// Add the package itself
	parts.push(formatPackageRef(displayName, pkg.version));

	return `  ${parts.join(' → ')}`;
};

type RenderOptions = {
	statusMessage?: string;
};

const createTable = (): SimpleTable => {
	const table = new SimpleTable();
	table.header(
		green('Package'),
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

	for (const pkg of packages) {
		table.row(
			formatPackageName(pkg),
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

		for (const pkg of groupData.packages) {
			table.row(
				formatGroupedPackageName(pkg, groupKey, groupBy),
				formatSize(pkg.size),
			);
		}

		// Empty row after each group
		table.row();
	}

	printTable(table, totalSize, options);
};

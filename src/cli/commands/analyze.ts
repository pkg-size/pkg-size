import { command } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import { analyzeNodeModules } from '../../install/analyze-node-modules.js';
import type { InstalledPackage } from '../../install/types.js';

const groupByOptions = ['scope', 'license', 'author'] as const;

type GroupBy = typeof groupByOptions[number] | undefined;

const GroupByType = (value: string): GroupBy => {
	if (!groupByOptions.includes(value as typeof groupByOptions[number])) {
		throw new Error(`Invalid group: "${value}". Must be: ${groupByOptions.join(', ')}`);
	}
	return value as GroupBy;
};

const comparePackages = (sortByProperty: string) => (a: InstalledPackage, b: InstalledPackage) => {
	if (sortByProperty === 'name') {
		return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
	}
	// Default: sort by size descending
	return b.size - a.size;
};

type PackageGroup = {
	packages: InstalledPackage[];
	totalSize: number;
};

const getScope = (packageName: string): string => {
	if (packageName.startsWith('@')) {
		const slashIndex = packageName.indexOf('/');
		if (slashIndex !== -1) {
			return packageName.slice(0, slashIndex);
		}
	}
	return '(unscoped)';
};

const getGroupKey = (
	pkg: InstalledPackage,
	groupBy: NonNullable<GroupBy>,
): string => {
	if (groupBy === 'scope') {
		return getScope(pkg.name);
	}
	if (groupBy === 'license') {
		return pkg.license ?? '(unknown)';
	}
	if (groupBy === 'author') {
		return pkg.author ?? '(unknown)';
	}
	return '(unknown)';
};

const groupPackages = (
	packages: InstalledPackage[],
	groupBy: NonNullable<GroupBy>,
): Record<string, PackageGroup> => {
	const groups: Record<string, PackageGroup> = {};

	for (const pkg of packages) {
		const key = getGroupKey(pkg, groupBy);
		if (!groups[key]) {
			groups[key] = {
				packages: [],
				totalSize: 0,
			};
		}
		groups[key].packages.push(pkg);
		groups[key].totalSize += pkg.size;
	}

	return groups;
};

export const analyzeCommand = command({
	name: 'analyze',
	parameters: ['[path]'],
	flags: {
		sortBy: {
			type: String,
			alias: 's',
			description: 'Sort list by (name, size)',
			default: 'size',
		},
		group: {
			type: GroupByType,
			alias: 'g',
			description: 'Group packages by (scope, license, author)',
		},
		json: {
			type: Boolean,
			description: 'JSON output',
		},
	},
	help: {
		description: 'Analyze the existing node_modules directory',
		examples: [
			'pkg-size analyze',
			'pkg-size analyze ./path/to/project',
			'pkg-size analyze --sort-by=name',
			'pkg-size analyze --group=scope',
			'pkg-size analyze --json',
		],
	},
}, async (argv) => {
	const projectPath = argv._.path ?? process.cwd();
	const { sortBy, group, json } = argv.flags;

	const data = await analyzeNodeModules(projectPath);

	const sortProperty = sortBy === 'name' ? 'name' : 'size';
	data.packages.sort(comparePackages(sortProperty));

	if (group) {
		const groups = groupPackages(data.packages, group);

		if (json) {
			console.log(JSON.stringify({
				...data,
				groups,
			}));
			return;
		}

		const getSize = (bytes: number): string => byteSize(bytes).toString();

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
			table.row(bold(groupKey), dim(getSize(groupData.totalSize)));

			// Sort packages within group
			groupData.packages.sort(comparePackages(sortProperty));

			for (const pkg of groupData.packages) {
				// For scope grouping, show shortened names for scoped packages
				const displayName = group === 'scope' && pkg.name.startsWith('@')
					? pkg.name.slice(groupKey.length + 1)
					: pkg.name;
				const versionSuffix = pkg.version ? ` ${dim(pkg.version)}` : '';
				table.row(
					`  ${cyan(displayName)}${versionSuffix}`,
					getSize(pkg.size),
				);
			}

			// Empty row after each group
			table.row();
		}

		table.row(
			bold('Total'),
			underline(getSize(data.totalSize)),
		);

		console.log(`${table.toString()}\n`);
		return;
	}

	if (json) {
		console.log(JSON.stringify(data));
		return;
	}

	const getSize = (bytes: number): string => byteSize(bytes).toString();

	console.log('');

	const table = new SimpleTable();

	table.header(
		green('Package'),
		{
			text: green('Size'),
			align: 'right' as const,
		},
	);

	for (const pkg of data.packages) {
		const versionSuffix = pkg.version ? ` ${dim(pkg.version)}` : '';
		table.row(
			`${cyan(pkg.name)}${versionSuffix}`,
			getSize(pkg.size),
		);
	}

	table.row();
	table.row(
		bold('Total'),
		underline(getSize(data.totalSize)),
	);

	console.log(`${table.toString()}\n`);
});

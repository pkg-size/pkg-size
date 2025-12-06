import { command } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import { analyzeNodeModules } from '../../install/analyze-node-modules.js';
import type { InstalledPackage } from '../../install/types.js';

const groupByOptions = ['scope'] as const;

type GroupBy = typeof groupByOptions[number] | undefined;

const GroupByType = (value: string): GroupBy => {
	if (!groupByOptions.includes(value as typeof groupByOptions[number])) {
		throw new Error(`Invalid group: "${value}". Must be: scope`);
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

const groupPackagesByScope = (
	packages: InstalledPackage[],
): Record<string, PackageGroup> => {
	const groups: Record<string, PackageGroup> = {};

	for (const pkg of packages) {
		const scope = getScope(pkg.name);
		if (!groups[scope]) {
			groups[scope] = {
				packages: [],
				totalSize: 0,
			};
		}
		groups[scope].packages.push(pkg);
		groups[scope].totalSize += pkg.size;
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
			description: 'Group packages by (scope)',
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

	if (group === 'scope') {
		const groups = groupPackagesByScope(data.packages);

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

		for (const [scope, groupData] of sortedGroups) {
			// Group header
			table.row(bold(scope), dim(getSize(groupData.totalSize)));

			// Sort packages within group
			groupData.packages.sort(comparePackages(sortProperty));

			for (const pkg of groupData.packages) {
				const displayName = pkg.name.startsWith('@')
					? pkg.name.slice(scope.length + 1)
					: pkg.name;
				table.row(
					`  ${cyan(displayName)}`,
					getSize(pkg.size),
				);
			}
		}

		table.row();
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
		table.row(
			cyan(pkg.name),
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

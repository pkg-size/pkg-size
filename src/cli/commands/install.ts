import { command } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import { getInstallSize } from '../../install/index.js';
import { detectPackageManager } from '../../utils/package-manager.js';
import type { InstalledPackage } from '../../install/types.js';

const packageManagers = ['npm', 'pnpm', 'yarn'] as const;

type PackageManager = typeof packageManagers[number];

const PackageManagerType = (value: string): PackageManager => {
	if (!packageManagers.includes(value as PackageManager)) {
		throw new Error(`Invalid package manager: "${value}". Must be: npm, pnpm, or yarn`);
	}
	return value as PackageManager;
};

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

const formatTime = (ms: number): string => {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
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

export const installCommand = command({
	name: 'install',
	parameters: ['<packages...>'],
	flags: {
		packageManager: {
			type: PackageManagerType,
			alias: 'p',
			description: 'Package manager to use (npm, pnpm, yarn). Auto-detected by default.',
		},
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
		description: 'Install packages in a temp directory and measure their size',
		examples: [
			'pkg-size install lodash',
			'pkg-size install react react-dom',
			'pkg-size install @babel/core typescript',
			'pkg-size install lodash --package-manager=pnpm',
			'pkg-size install @babel/core --group=scope',
			'pkg-size install lodash --json',
		],
	},
}, async (argv) => {
	const { packages } = argv._;
	const { sortBy, group, json } = argv.flags;
	const packageManager = argv.flags.packageManager ?? detectPackageManager();

	if (!json) {
		console.log('');
		console.log(dim(`Installing with ${packageManager}...`));
	}

	const data = await getInstallSize(packages, { packageManager });

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

		console.log(dim(`Completed in ${formatTime(data.installTime)}`));
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

	console.log(dim(`Completed in ${formatTime(data.installTime)}`));
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

import { command } from 'cleye';
import { dim } from 'ansis';
import { getInstallSize } from '../../install/index.js';
import { detectPackageManager } from '../../utils/package-manager.js';
import { GroupByType, groupPackages } from '../../utils/grouping.js';
import {
	SortByType,
	defaultSortBy,
	comparePackages,
} from '../../utils/sorting.js';
import {
	renderPackagesTable,
	renderGroupedPackagesTable,
} from '../ui/packages-table.js';

const packageManagers = ['npm', 'pnpm', 'yarn'] as const;

type PackageManager = typeof packageManagers[number];

const PackageManagerType = (value: string): PackageManager => {
	if (!packageManagers.includes(value as PackageManager)) {
		throw new Error(`Invalid package manager: "${value}". Must be: npm, pnpm, or yarn`);
	}
	return value as PackageManager;
};

const formatTime = (ms: number): string => {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
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
			type: SortByType,
			alias: 's',
			description: 'Sort by property:direction (e.g., size:desc,name:asc)',
			default: defaultSortBy,
		},
		groupBy: {
			type: GroupByType,
			alias: 'g',
			description: 'Group packages by (scope, license, author, level)',
		},
		verbose: {
			type: Boolean,
			alias: 'v',
			description: 'Show dependency paths for transitive dependencies',
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
			'pkg-size install @babel/core --group-by=scope',
			'pkg-size install vue react --group-by=level',
			'pkg-size install lodash --json',
		],
	},
}, async (argv) => {
	const { packages } = argv._;
	const {
		sortBy,
		groupBy,
		json,
		verbose,
	} = argv.flags;
	const packageManager = argv.flags.packageManager ?? detectPackageManager();

	if (!json) {
		console.log('');
		console.log(dim(`Installing with ${packageManager}...`));
	}

	const data = await getInstallSize(packages, {
		packageManager,
		verbose,
	});

	data.packages.sort(comparePackages(sortBy));

	const statusMessage = `Completed in ${formatTime(data.installTime)}`;

	if (groupBy) {
		const groups = groupPackages(data.packages, groupBy);

		if (json) {
			console.log(JSON.stringify({
				...data,
				groups,
			}));
			return;
		}

		renderGroupedPackagesTable(groups, data.totalSize, groupBy, {
			statusMessage,
			verbose,
			sortBy,
		});
		return;
	}

	if (json) {
		console.log(JSON.stringify(data));
		return;
	}

	renderPackagesTable(data.packages, data.totalSize, {
		statusMessage,
		verbose,
	});
});

import { command } from 'cleye';
import { dim } from 'ansis';
import { getInstallSize } from '../../install/index.js';
import { detectPackageManager } from '../../utils/package-manager.js';
import {
	GroupByType,
	groupPackages,
	comparePackages,
} from '../../utils/grouping.js';
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
			'pkg-size install @babel/core --group=scope',
			'pkg-size install lodash --json',
		],
	},
}, async (argv) => {
	const { packages } = argv._;
	const {
		sortBy,
		group,
		json,
		verbose,
	} = argv.flags;
	const packageManager = argv.flags.packageManager ?? detectPackageManager();

	if (!json) {
		console.log('');
		console.log(dim(`Installing with ${packageManager}...`));
	}

	const data = await getInstallSize(packages, { packageManager });

	const sortProperty = sortBy === 'name' ? 'name' : 'size';
	data.packages.sort(comparePackages(sortProperty));

	const statusMessage = `Completed in ${formatTime(data.installTime)}`;

	if (group) {
		const groups = groupPackages(data.packages, group);

		if (json) {
			console.log(JSON.stringify({
				...data,
				groups,
			}));
			return;
		}

		renderGroupedPackagesTable(groups, data.totalSize, sortProperty, {
			statusMessage,
			verbose,
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

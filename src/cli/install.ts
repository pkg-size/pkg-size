import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import { getInstallSize } from '../install/index.js';
import { detectPackageManager } from '../utils/package-manager.js';
import type { PackageEntry } from '../install/types.js';

const comparePackages = (sortByProperty: string) => (a: PackageEntry, b: PackageEntry) => {
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

export type InstallModeOptions = {
	packageManager?: string;
	sortBy: string;
	json?: boolean;
};

export const runInstallMode = async (packageSpecs: string[], options: InstallModeOptions) => {
	const { sortBy, json } = options;
	const packageManager = options.packageManager ?? detectPackageManager();

	if (!json) {
		console.log('');
		console.log(dim(`Installing with ${packageManager}...`));
	}

	const data = await getInstallSize(packageSpecs.join(' '), { packageManager });

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

	const sortProperty = sortBy === 'name' ? 'name' : 'size';
	data.packages.sort(comparePackages(sortProperty));

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
};

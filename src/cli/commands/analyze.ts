import { command } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline,
} from 'yoctocolors';
import { analyzeNodeModules } from '../../install/analyze-node-modules.js';
import type { InstalledPackage } from '../../install/types.js';

const comparePackages = (sortByProperty: string) => (a: InstalledPackage, b: InstalledPackage) => {
	if (sortByProperty === 'name') {
		return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
	}
	// Default: sort by size descending
	return b.size - a.size;
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
			'pkg-size analyze --json',
		],
	},
}, async (argv) => {
	const projectPath = argv._.path ?? process.cwd();
	const { sortBy, json } = argv.flags;

	const data = await analyzeNodeModules(projectPath);

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
});

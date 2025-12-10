import { command } from 'cleye';
import { analyzeNodeModules } from '../../install/analyze-node-modules.js';
import {
	GroupByType,
	groupPackages,
	comparePackages,
} from '../../utils/grouping.js';
import {
	renderPackagesTable,
	renderGroupedPackagesTable,
} from '../ui/packages-table.js';

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
	const {
		sortBy,
		group,
		json,
		verbose,
	} = argv.flags;

	const data = await analyzeNodeModules(projectPath, undefined, verbose);

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

		renderGroupedPackagesTable(groups, data.totalSize, group, sortProperty, { verbose });
		return;
	}

	if (json) {
		console.log(JSON.stringify(data));
		return;
	}

	renderPackagesTable(data.packages, data.totalSize, { verbose });
});

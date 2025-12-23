import { command } from 'cleye';
import { analyzeNodeModules } from '../../install/analyze-node-modules.js';
import { GroupByType, groupPackages } from '../../utils/grouping.js';
import {
	SortByType,
	defaultSortBy,
	comparePackages,
	applySortByGrouping,
} from '../../utils/sorting.js';
import {
	renderPackagesTable,
	renderGroupedPackagesTable,
} from '../ui/packages-table.js';

export const analyzeCommand = command({
	name: 'analyze',
	parameters: ['[path]'],
	flags: {
		sortBy: {
			type: SortByType,
			alias: 's',
			description: 'Sort by property:direction (e.g., size:desc,name:asc)',
			default: defaultSortBy,
		},
		groupBy: {
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
			'pkg-size analyze --group-by=scope',
			'pkg-size analyze --json',
		],
	},
}, async (argv) => {
	const projectPath = argv._.path ?? process.cwd();
	const {
		sortBy,
		groupBy,
		json,
		verbose,
	} = argv.flags;

	const data = await analyzeNodeModules(projectPath, undefined, verbose);

	const effectiveSortBy = applySortByGrouping(sortBy, groupBy);
	data.packages.sort(comparePackages(effectiveSortBy));

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
			verbose,
			sortBy: effectiveSortBy,
		});
		return;
	}

	if (json) {
		console.log(JSON.stringify(data));
		return;
	}

	renderPackagesTable(data.packages, data.totalSize, { verbose });
});

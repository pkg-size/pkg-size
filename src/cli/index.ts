import { cli } from 'cleye';
import packageJson from '../../package.json';
import { publishCommand } from './commands/publish.js';
import { installCommand } from './commands/install.js';
import { scanCommand } from './commands/scan.js';

const argv = cli({
	name: packageJson.name,
	version: packageJson.version,
	commands: [
		publishCommand,
		installCommand,
		scanCommand,
	],
	help: {
		examples: [
			'# Analyze publish size of current package',
			'pkg-size publish',
			'',
			'# Measure install size of npm packages',
			'pkg-size install lodash react',
			'',
			'# Analyze existing node_modules',
			'pkg-size scan',
		],
	},
});

// Show help if no command was provided or an invalid command was used
if (!argv.command) {
	argv.showHelp();
}

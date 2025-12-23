import { cli } from 'cleye';
import packageJson from '../../package.json';
import { publishCommand } from './commands/publish.js';
import { installCommand } from './commands/install.js';
import { analyzeCommand } from './commands/analyze.js';

try {
	const argv = cli({
		name: packageJson.name,
		version: packageJson.version,
		strictFlags: true,
		commands: [
			publishCommand,
			installCommand,
			analyzeCommand,
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
				'pkg-size analyze',
			],
		},
	});

	// Show help if no command was provided or an invalid command was used
	if (!argv.command) {
		argv.showHelp();
	}
} catch (error) {
	console.error('Error:', (error as Error).message);
	process.exitCode = 1;
}

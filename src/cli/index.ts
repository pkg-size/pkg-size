import path from 'node:path';
import { cli } from 'cleye';
import packageJson from '../../package.json';
import { runLocalMode } from './local.js';
import { runInstallMode } from './install.js';

// Only explicit path indicators - no fs.existsSync to avoid shadowing
// (e.g., a folder named "test" shouldn't shadow the npm package "test")
const isLocalPath = (argument: string): boolean => (
	argument.startsWith('.') || path.isAbsolute(argument)
);

const compressions = ['gzip', 'brotli'] as const;

type Compression = typeof compressions[number] | false;

const CompressionType = (value: string): Compression => {
	if (value === 'false') {
		return false;
	}
	if (!compressions.includes(value as typeof compressions[number])) {
		throw new Error(`Invalid compression: "${value}". Must be: gzip, brotli, or false`);
	}
	return value as typeof compressions[number];
};

const packageManagers = ['npm', 'pnpm', 'yarn'] as const;

type PackageManager = typeof packageManagers[number];

const PackageManagerType = (value: string): PackageManager => {
	if (!packageManagers.includes(value as PackageManager)) {
		throw new Error(`Invalid package manager: "${value}". Must be: npm, pnpm, or yarn`);
	}
	return value as PackageManager;
};

const argv = cli({
	name: packageJson.name,
	version: packageJson.version,
	parameters: ['[packages...]'],
	flags: {
		compression: {
			type: CompressionType,
			alias: 'c',
			description: 'Compression algorithm (gzip, brotli) or false to disable',
			default: 'gzip',
		},
		sortBy: {
			type: String,
			alias: 's',
			description: 'Sort list by (name, size, compressed)',
			default: 'compressed',
		},
		ignoreFiles: {
			type: String,
			alias: 'i',
			description: 'Glob to ignores files from list. Total size will still include them.',
		},
		json: {
			type: Boolean,
			description: 'JSON output',
		},
		packageManager: {
			type: PackageManagerType,
			alias: 'p',
			description: 'Package manager to use for install mode (npm, pnpm, yarn). Auto-detected by default.',
		},
	},
	help: {
		examples: [
			'# Analyze local package',
			'pkg-size',
			'pkg-size ./package/path',
			'',
			'# Measure install size of npm packages',
			'pkg-size lodash react vue',
			'pkg-size @babel/core typescript',
			'',
			'# Compression options (local mode only)',
			'pkg-size --compression=brotli',
			'pkg-size --compression=false',
			'',
			'# Sorting and display',
			'pkg-size --sort-by=name',
		],
	},
});

(async () => {
	const packages = argv._.packages ?? [];
	const {
		compression, sortBy, ignoreFiles, json, packageManager,
	} = argv.flags;

	// Local mode: no args or single local path
	const localPath = packages.length === 0
		? process.cwd()
		: (packages.length === 1 && isLocalPath(packages[0]) ? packages[0] : null);

	if (localPath) {
		await runLocalMode(localPath, {
			compression,
			sortBy,
			ignoreFiles,
			json,
		});
		return;
	}

	// Check if all args are local paths (error - can only do one local path at a time)
	const localPaths = packages.filter(p => isLocalPath(p));
	if (localPaths.length > 0 && localPaths.length < packages.length) {
		console.error('Error: Cannot mix local paths with package names');
		process.exit(1);
	}

	if (localPaths.length > 1) {
		console.error('Error: Can only analyze one local path at a time');
		process.exit(1);
	}

	// All args are package specs: install mode
	await runInstallMode(packages, {
		packageManager,
		sortBy,
		json,
	});
})();

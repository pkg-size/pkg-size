import { cli } from 'cleye';
import packageJson from '../../package.json';
import { isLocalPath } from '../install/index.js';
import { runLocalMode } from './local.js';
import { runInstallMode } from './install.js';

type Compression = 'gzip' | 'brotli' | 'zstd' | false;

const CompressionType = (value: string): Compression => {
	if (value === 'false') {
		return false;
	}
	const valid = ['gzip', 'brotli', 'zstd'];
	if (!valid.includes(value)) {
		throw new Error(`Invalid compression: "${value}". Must be: gzip, brotli, zstd, or false`);
	}
	return value as 'gzip' | 'brotli' | 'zstd';
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
			description: 'Compression algorithm (gzip, brotli, zstd) or false to disable',
			default: 'gzip',
		},
		sortBy: {
			type: String,
			alias: 's',
			description: 'Sort list by (name, size, compressed)',
			default: 'compressed',
		},
		unit: {
			type: String,
			alias: 'u',
			description: 'Display units (metric, iec, metric_octet, iec_octet)',
			default: 'metric',
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
			'pkg-size --unit=iec',
		],
	},
});

(async () => {
	const packages = argv._.packages ?? [];
	const {
		compression, sortBy, unit, ignoreFiles, json, packageManager,
	} = argv.flags;

	// No args: analyze cwd
	if (packages.length === 0) {
		await runLocalMode(process.cwd(), {
			compression,
			sortBy,
			unit,
			ignoreFiles,
			json,
		});
		return;
	}

	// Single arg that's a local path: analyze that path
	if (packages.length === 1 && isLocalPath(packages[0])) {
		await runLocalMode(packages[0], {
			compression,
			sortBy,
			unit,
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
		unit,
		json,
	});
})();

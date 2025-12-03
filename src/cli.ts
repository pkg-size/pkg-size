import { cli } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, dim,
} from 'yoctocolors';
import packageJson from '../package.json';
import type { FileEntry } from './interfaces.js';
import {
	installSize, isLocalPath, type InstallSizeData, type PackageEntry,
} from './install-size.js';
import pkgSize from './index.js';

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

const compareFiles = (sortBy: keyof FileEntry) => (a: FileEntry, b: FileEntry) => {
	const aValue = a[sortBy];
	const bValue = b[sortBy];

	if (typeof aValue === 'number' && typeof bValue === 'number') {
		return bValue - aValue;
	}

	if (typeof aValue === 'string' && typeof bValue === 'string') {
		return aValue < bValue ? -1 : (aValue > bValue ? 1 : 0);
	}

	return 0;
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

const getSize = (bytes: number): string => byteSize(bytes, {
	units: argv.flags.unit,
}).toString();

type NumericFileEntryKey = 'size' | 'sizeGzip' | 'sizeBrotli' | 'sizeZstd';

const compressionToProperty: Record<string, NumericFileEntryKey> = {
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
	zstd: 'sizeZstd',
};

const compressionToLabel: Record<string, string> = {
	brotli: 'Brotli',
	gzip: 'Gzip',
	zstd: 'Zstd',
};

const { compression } = argv.flags;
const sizes: string[] = compression ? ['size', compression] : ['size'];

const sortByFlag = argv.flags.sortBy;
const getSortProperty = (): keyof FileEntry => {
	if (sortByFlag === 'compressed') {
		return compression ? compressionToProperty[compression] : 'size';
	}
	if (sortByFlag === 'size') {
		return 'size';
	}
	return 'path';
};
const sortBy = getSortProperty();

const comparePackages = (sortByProperty: string) => (a: PackageEntry, b: PackageEntry) => {
	if (sortByProperty === 'name') {
		return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
	}
	// Default: sort by size descending
	return b.size - a.size;
};

const formatTime = (ms: number): string => {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
};

const runLocalMode = async (pkgPath: string) => {
	const distData = await pkgSize(pkgPath, {
		sizes,
		ignoreFiles: argv.flags.ignoreFiles,
	});

	if (argv.flags.json) {
		console.log(JSON.stringify(distData));
		return;
	}

	console.log('');
	console.log(green(bold('Package path')));
	console.log(`${distData.pkgPath}\n`);
	console.log(green(bold('Tarball size')));
	console.log(`${getSize(distData.tarballSize)}\n`);

	const table = new SimpleTable();

	const headers = compression
		? [
			green('File'),
			{
				text: green('Size'),
				align: 'right' as const,
			},
			{
				text: green(compressionToLabel[compression]),
				align: 'right' as const,
			},
		]
		: [
			green('File'),
			{
				text: green('Size'),
				align: 'right' as const,
			},
		];

	table.header(...headers);

	let totalSize = 0;
	let totalCompressed = 0;

	distData.files.sort(compareFiles(sortBy));

	for (const file of distData.files) {
		const row = compression
			? [cyan(file.path), getSize(file.size), getSize(file[compressionToProperty[compression]])]
			: [cyan(file.path), getSize(file.size)];
		table.row(...row);

		totalSize += file.size;
		if (compression) {
			totalCompressed += file[compressionToProperty[compression]];
		}
	}

	table.row();

	const totalsRow = compression
		? ['', underline(getSize(totalSize)), underline(getSize(totalCompressed))]
		: ['', underline(getSize(totalSize))];
	table.row(...totalsRow);

	console.log(`${table.toString()}\n`);
};

const runInstallMode = async (packageSpecs: string[]) => {
	console.log('');
	console.log(dim(`Installing ${packageSpecs.length} package${packageSpecs.length > 1 ? 's' : ''}...`));
	console.log('');

	const data: InstallSizeData = await installSize(packageSpecs);

	if (argv.flags.json) {
		console.log(JSON.stringify(data));
		return;
	}

	const table = new SimpleTable();

	table.header(
		green('Package'),
		{
			text: green('Size'),
			align: 'right' as const,
		},
		{
			text: green('Files'),
			align: 'right' as const,
		},
	);

	const sortProperty = argv.flags.sortBy === 'name' ? 'name' : 'size';
	data.packages.sort(comparePackages(sortProperty));

	for (const pkg of data.packages) {
		table.row(
			cyan(pkg.name),
			getSize(pkg.size),
			String(pkg.files),
		);
	}

	table.row();
	table.row(
		'',
		underline(getSize(data.totalSize)),
		underline(String(data.totalFiles)),
	);

	console.log(`${table.toString()}\n`);
	console.log(dim(`Installed in ${formatTime(data.installTime)} with ${data.packageManager}`));
	console.log('');
};

(async () => {
	const packages = argv._.packages ?? [];

	// No args: analyze cwd
	if (packages.length === 0) {
		await runLocalMode(process.cwd());
		return;
	}

	// Single arg that's a local path: analyze that path
	if (packages.length === 1 && isLocalPath(packages[0])) {
		await runLocalMode(packages[0]);
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
	await runInstallMode(packages);
})();

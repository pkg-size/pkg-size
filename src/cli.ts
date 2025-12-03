import { cli } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline,
} from 'yoctocolors';
import packageJson from '../package.json';
import type { FileEntry } from './interfaces.js';
import pkgSize from './index.js';

type Compression = 'gzip' | 'brotli' | false;

const CompressionType = (value: string): Compression => {
	if (value === 'false') {
		return false;
	}
	const valid = ['gzip', 'brotli'];
	if (!valid.includes(value)) {
		throw new Error(`Invalid compression: "${value}". Must be: gzip, brotli, or false`);
	}
	return value as 'gzip' | 'brotli';
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
	parameters: ['[pkg-path]'],
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
			'pkg-size',
			'pkg-size ./package/path',
			'',
			'pkg-size --compression=brotli',
			'pkg-size --compression=false',
			'',
			'pkg-size --sort-by=name',
			'pkg-size -s size',
			'',
			'pkg-size --unit=iec',
			'pkg-size -u metric_octet',
		],
	},
});

const getSize = (bytes: number): string => byteSize(bytes, {
	units: argv.flags.unit,
}).toString();

type NumericFileEntryKey = 'size' | 'sizeGzip' | 'sizeBrotli';

const compressionToProperty: Record<string, NumericFileEntryKey> = {
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
};

const compressionToLabel: Record<string, string> = {
	brotli: 'Brotli',
	gzip: 'Gzip',
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

(async () => {
	const pkgPath = argv._.pkgPath ?? process.cwd();
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
})();

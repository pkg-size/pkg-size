import { cli } from 'cleye';
import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline,
} from 'yoctocolors';
import packageJson from '../package.json';
import type { FileEntry } from './interfaces.js';
import pkgSize from './index.js';

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
		sizes: {
			type: String,
			alias: 'S',
			description: 'Comma separated list of sizes to show (size, gzip, brotli)',
			default: 'size,gzip,brotli',
		},
		sortBy: {
			type: String,
			alias: 's',
			description: 'Sort list by (name, size, gzip, brotli)',
			default: 'brotli',
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
			'pkg-size --sizes=size,gzip,brotli',
			'pkg-size -S brotli',
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

const sizeToProperty: Record<string, NumericFileEntryKey> = {
	size: 'size',
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
};

const sizeToLabel: Record<string, string> = {
	size: 'Size',
	brotli: 'Brotli',
	gzip: 'Gzip',
};

const sortByFlag = argv.flags.sortBy;
const sortBy: keyof FileEntry = sortByFlag in sizeToProperty
	? sizeToProperty[sortByFlag]
	: sortByFlag as keyof FileEntry;

(async () => {
	const pkgPath = argv._.pkgPath ?? process.cwd();
	const sizes = argv.flags.sizes.split(',').map(size => size.trim());
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

	table.header(
		green('File'),
		...sizes.map(size => ({
			text: green(sizeToLabel[size]),
			align: 'right',
		}) as const),
	);

	const total = {
		size: 0,
		sizeGzip: 0,
		sizeBrotli: 0,
	};

	distData.files.sort(compareFiles(sortBy));

	for (const file of distData.files) {
		table.row(
			cyan(file.path),
			...sizes.map(
				size => getSize(file[sizeToProperty[size]]),
			),
		);

		total.size += file.size;
		total.sizeGzip += file.sizeGzip;
		total.sizeBrotli += file.sizeBrotli;
	}

	table.row();

	table.row(
		'',
		...sizes.map(
			size => underline(getSize(total[sizeToProperty[size]])),
		),
	);

	console.log(`${table.toString()}\n`);
})();

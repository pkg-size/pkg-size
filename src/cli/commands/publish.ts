import { command } from 'cleye';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline, yellow,
} from 'ansis';
import { getPackageSize } from '../../local/index.js';
import type { FileEntry } from '../../local/types.js';
import { printRows } from '../ui/table.js';

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

type NumericFileEntryKey = 'size' | 'sizeGzip' | 'sizeBrotli';

const compressionToProperty: Record<string, NumericFileEntryKey> = {
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
};

const compressionToLabel: Record<string, string> = {
	brotli: 'Brotli',
	gzip: 'Gzip',
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

const getSortProperty = (
	sortBy: string,
	compression: string | false,
): keyof FileEntry => {
	if (sortBy === 'compressed') {
		return compression ? compressionToProperty[compression] : 'size';
	}
	if (sortBy === 'size') {
		return 'size';
	}
	return 'path';
};

export const publishCommand = command({
	name: 'publish',
	parameters: ['[path]'],
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
			description: 'Glob to ignore files from list. Total size will still include them.',
		},
		json: {
			type: Boolean,
			description: 'JSON output',
		},
	},
	help: {
		description: 'Analyze the publish size of a package (what gets uploaded to npm)',
		examples: [
			'pkg-size publish',
			'pkg-size publish ./path/to/package',
			'pkg-size publish --compression=brotli',
			'pkg-size publish --json',
		],
	},
}, async (argv) => {
	const packagePath = argv._.path ?? process.cwd();
	const {
		compression, sortBy, ignoreFiles, json,
	} = argv.flags;
	const sizes: string[] = compression ? ['size', compression] : ['size'];

	const distData = await getPackageSize(packagePath, {
		sizes,
		ignoreFiles,
	});

	if (json) {
		console.log(JSON.stringify(distData));
		return;
	}

	if (distData.privatePackage) {
		console.log(yellow('Warning: This package is marked private in package.json.'));
	}

	const getSize = (bytes: number): string => byteSize(bytes).toString();

	console.log('');
	console.log(green(bold('Package path')));
	console.log(`${distData.packagePath}\n`);
	console.log(green(bold('Tarball size')));
	console.log(`${getSize(distData.tarballSize)}\n`);

	// Header
	const headers = compression
		? [green('File'), green('Size'), green(compressionToLabel[compression])]
		: [green('File'), green('Size')];
	const rows: string[][] = [
		headers,
		headers.map(() => ''),
	];

	let totalSize = 0;
	let totalCompressed = 0;

	const sortProperty = getSortProperty(sortBy, compression);
	distData.files.sort(compareFiles(sortProperty));

	for (const file of distData.files) {
		const row = compression
			? [cyan(file.path), getSize(file.size), getSize(file[compressionToProperty[compression]])]
			: [cyan(file.path), getSize(file.size)];
		rows.push(row);

		totalSize += file.size;
		if (compression) {
			totalCompressed += file[compressionToProperty[compression]];
		}
	}

	rows.push(headers.map(() => ''));

	const totalsRow = compression
		? ['', underline(getSize(totalSize)), underline(getSize(totalCompressed))]
		: ['', underline(getSize(totalSize))];
	rows.push(totalsRow);

	printRows(rows, { align: ['left', 'right', 'right'] });
	console.log('');
});

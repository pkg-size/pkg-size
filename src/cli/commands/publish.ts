import { command } from 'cleye';
import { underline, yellow, bold } from 'ansis';
import { getPackageSize } from '../../local/index.js';
import type { FileEntry } from '../../local/types.js';
import { amberEarth, orange } from '../ui/colors.js';
import { formatSize } from '../ui/format.js';
import { printRows } from '../ui/table.js';

const sizeTypes = ['raw', 'gzip', 'brotli'] as const;

type SizeType = typeof sizeTypes[number];

const SizeTypeValidator = (value: string): SizeType => {
	if (!sizeTypes.includes(value as SizeType)) {
		throw new Error(`Invalid size type: "${value}". Must be: raw, gzip, or brotli`);
	}
	return value as SizeType;
};

const sizeTypeToProperty: Record<SizeType, keyof FileEntry> = {
	raw: 'size',
	gzip: 'sizeGzip',
	brotli: 'sizeBrotli',
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
	sizeType: SizeType,
): keyof FileEntry => {
	if (sortBy === 'size') {
		return sizeTypeToProperty[sizeType];
	}
	return 'path';
};

export const publishCommand = command({
	name: 'publish',
	parameters: ['[path]'],
	flags: {
		size: {
			type: SizeTypeValidator,
			description: 'Size type to display (raw, gzip, brotli)',
			default: 'raw',
		},
		sortBy: {
			type: String,
			alias: 's',
			description: 'Sort list by (name, size)',
			default: 'size',
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
			'pkg-size publish --size=gzip',
			'pkg-size publish --json',
		],
	},
}, async (argv) => {
	const packagePath = argv._.path ?? process.cwd();
	const { sortBy, ignoreFiles, json } = argv.flags;
	const size = argv.flags.size as SizeType;

	const distData = await getPackageSize(packagePath, {
		sizes: size === 'raw' ? ['size'] : [size],
		ignoreFiles,
	});

	if (json) {
		console.log(JSON.stringify(distData));
		return;
	}

	console.log(`${bold('Package:')} ${distData.packagePath}`);

	if (distData.privatePackage) {
		console.log(yellow('Warning: This package is marked private in package.json.'));
	}

	const sizeProperty = sizeTypeToProperty[size];

	const sortProperty = getSortProperty(sortBy, size);
	distData.files.sort(compareFiles(sortProperty));

	// Calculate total
	let totalSize = 0;
	for (const file of distData.files) {
		totalSize += file[sizeProperty] as number;
	}

	// Header with total size and file count (like install/analyze)
	const fileCount = distData.files.length;
	const fileLabel = fileCount === 1 ? 'File' : 'Files';

	console.log('');

	printRows(
		[
			[
				underline(amberEarth(`${formatSize(totalSize)}`)),
				underline(amberEarth(`${fileCount} ${fileLabel}`)),
			],
			['', ''],
			...distData.files.map(file => [
				formatSize(file[sizeProperty] as number),
				orange(file.path),
			]),
			['', ''],
			[
				formatSize(distData.tarballSize),
				bold('Tarball'),
			],
		],
		{ align: ['right', 'left'] },
	);
});

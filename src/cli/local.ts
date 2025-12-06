import SimpleTable from 'cli-simple-table';
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline,
} from 'yoctocolors';
import { getPackageSize } from '../local/index.js';
import type { FileEntry } from '../local/types.js';

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

export type LocalModeOptions = {
	compression: string | false;
	sortBy: string;
	unit: string;
	ignoreFiles?: string;
	json?: boolean;
};

export const getSortProperty = (
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

export const runLocalMode = async (pkgPath: string, options: LocalModeOptions) => {
	const {
		compression, sortBy, unit, ignoreFiles, json,
	} = options;
	const sizes: string[] = compression ? ['size', compression] : ['size'];

	const distData = await getPackageSize(pkgPath, {
		sizes,
		ignoreFiles,
	});

	if (json) {
		console.log(JSON.stringify(distData));
		return;
	}

	const getSize = (bytes: number): string => byteSize(bytes, { units: unit }).toString();

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

	const sortProperty = getSortProperty(sortBy, compression);
	distData.files.sort(compareFiles(sortProperty));

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

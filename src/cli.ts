import cac from 'cac';
import SimpleTable from 'cli-simple-table'; // eslint-disable-line import/no-unresolved
import byteSize from 'byte-size';
import {
	green, cyan, bold, underline,
} from 'colorette';
import pkgSize from './pkg-size';
import { FileEntry } from './interfaces';

const pkgJsn = require('../package.json'); // eslint-disable-line @typescript-eslint/no-var-requires

const compareFiles = (sortBy: keyof FileEntry) => (a: FileEntry, b: FileEntry) => {
	const aValue = a[sortBy];
	const bValue = b[sortBy];

	if (typeof aValue === 'number' && typeof bValue === 'number') {
		return bValue - aValue;
	}

	if (typeof aValue === 'string' && typeof bValue === 'string') {
		return aValue.localeCompare(bValue);
	}

	return 0;
};

type CliOptions = {
	sizes?: string;
	sortBy?: ('gzip' | 'brotli') & keyof FileEntry;
	unit?: string;
	ignoreFiles?: string;
	json?: boolean;
	help?: boolean;
	version?: boolean;
};

const cli = cac('pkg-size')

	.usage('<pkg-path>')

	.option('-S, --sizes <sizes>', 'Comma separated list of sizes to show (size, gzip, brotli)', {
		default: 'size,gzip,brotli',
	})
	.option('-s, --sort-by <property>', 'Sort list by (name, size, gzip, brotli)', {
		default: 'brotli',
	})
	.option('-u, --unit <unit>', 'Display units (metric, iec, metric_octet, iec_octet)', {
		default: 'metric',
	})
	.option('-i, --ignore-files <glob>', 'Glob to ignores files from list. Total size will still include them.')
	.option('--json', 'JSON output')

	.help()
	.version(pkgJsn.version)

	.example('$ pkg-size')
	.example('$ pkg-size ./pkg/path')
	.example('')
	.example('$ pkg-size --sizes=size,gzip,brotli')
	.example('$ pkg-size -D brotli')
	.example('')
	.example('$ pkg-size --sort-by=name')
	.example('$ pkg-size -s size')
	.example('')
	.example('$ pkg-size --unit=iec')
	.example('$ pkg-size -u metric_octet')
	.example('');

const parsed = cli.parse();
const flags: CliOptions = parsed.options;

const getSize = (bytes: number): string => byteSize(bytes, {
	units: flags.unit,
});

const sizeToProperty = {
	size: 'size',
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
};

const sizeToLabel = {
	size: 'Size',
	brotli: 'Brotli',
	gzip: 'Gzip',
};

const sortBy: keyof FileEntry = (
	flags.sortBy in sizeToProperty
		? sizeToProperty[flags.sortBy]
		: flags.sortBy
);

if (flags.help || flags.version) {
	process.exit(0); // eslint-disable-line unicorn/no-process-exit
}

(async () => {
	const pkgPath = parsed.args[0] ?? process.cwd();
	const sizes = flags.sizes.split(',').map(size => size.trim());
	const distData = await pkgSize(pkgPath, {
		sizes,
		ignoreFiles: flags.ignoreFiles,
	});

	if (flags.json) {
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

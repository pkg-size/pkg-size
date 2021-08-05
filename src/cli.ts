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
	sortBy?: ('gzip' | 'brotli') & keyof FileEntry;
	unit?: string;
	ignoreFiles?: string;
	json?: boolean;
	help?: boolean;
	version?: boolean;
};

const cli = cac('pkg-size')

	.usage('<pkg-path>')

	.option('-s, --sort-by [property]', 'Sort list by (name, size, gzip, brotli)', {
		default: 'brotli',
	})
	.option('-u, --unit [unit]', 'Display units (metric, iec, metric_octet, iec_octet)', {
		default: 'metric',
	})
	.option('-i, --ignore-files [glob]', 'Glob to ignores files from list. Total size will still include them.')
	.option('--json', 'JSON output')

	.help()
	.version(pkgJsn.version)

	.example('$ pkg-size')
	.example('$ pkg-size ./pkg/path')
	.example('')
	.example('$ pkg-size --sort-by=name')
	.example('$ pkg-size -s brotli')
	.example('')
	.example('$ pkg-size --unit=iec')
	.example('$ pkg-size -u metric_octet')
	.example('');

const parsed = cli.parse();
const flags: CliOptions = parsed.options;

const getSize = (bytes: number): string => byteSize(bytes, {
	units: flags.unit,
});

const sortByConverter = {
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
};

const sortBy: keyof FileEntry = (
	flags.sortBy in sortByConverter
		? sortByConverter[flags.sortBy]
		: flags.sortBy
);

if (flags.help || flags.version) {
	process.exit(0); // eslint-disable-line unicorn/no-process-exit
}

(async () => {
	const pkgPath = parsed.args[0] ?? process.cwd();
	const distData = await pkgSize(pkgPath, {
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
		{
			text: green('Size'),
			align: 'right',
		},
		{
			text: green('Gzip'),
			align: 'right',
		},
		{
			text: green('Brotli'),
			align: 'right',
		},
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
			getSize(file.size),
			getSize(file.sizeGzip),
			getSize(file.sizeBrotli),
		);

		total.size += file.size;
		total.sizeGzip += file.sizeGzip;
		total.sizeBrotli += file.sizeBrotli;
	}

	table.row();

	table.row(
		'',
		underline(getSize(total.size)),
		underline(getSize(total.sizeGzip)),
		underline(getSize(total.sizeBrotli)),
	);

	console.log(`${table.toString()}\n`);
})();

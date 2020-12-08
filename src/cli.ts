import meow from 'meow';
import SimpleTable from 'cli-simple-table';
// @ts-expect-error
import byteSize from 'byte-size';
import chalk from 'chalk';
import globToRegexp from 'glob-to-regexp';
import pkgSize from './pkg-size';
import {FileEntry} from './interfaces';

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
};

const cli = meow(`
	Usage
	  $ pkg-size <pkg-path>

	Options
	  --sort-by, -s        Sort list by (name, size, gzip, brotli) (Default: brotli)
	  --unit, -u           Display units (metric, iec, metric_octet, iec_octet) (Default: metric)
	  --ignore-files, -i   Glob to ignores files from list. Total size will still include them.
	  --json               JSON output
	  --help               Show help
	  --version            Show version

	Examples
	  $ pkg-size
	  $ pkg-size ./pkg/path

	  $ pkg-size --sort-by=name
	  $ pkg-size -s brotli

	  $ pkg-size --unit=iec
	  $ pkg-size -u metric_octet
`, {
	flags: {
		'sort-by': {
			type: 'string',
			alias: 's',
			default: 'brotli',
		},
		unit: {
			type: 'string',
			alias: 'u',
			default: 'metric',
		},
		'ignore-files': {
			type: 'string',
			alias: 'i',
		},
		json: {
			type: 'boolean',
			default: false,
		},
	},
});

const flags: CliOptions = cli.flags;

const getSize = (bytes: number): string => byteSize(bytes, {
	units: flags.unit,
});

const sortByConverter = {
	brotli: 'sizeBrotli',
	gzip: 'sizeGzip',
};

const sortBy: keyof FileEntry = (flags.sortBy! in sortByConverter) ? sortByConverter[flags.sortBy!] : flags.sortBy!;

void pkgSize(cli.input[0]).then(distData => {
	if (flags.ignoreFiles) {
		const ignorePattern = globToRegexp(flags.ignoreFiles, {extended: true});
		distData.files = distData.files.filter(file => !ignorePattern.test(file.path));
	}

	if (flags.json) {
		console.log(JSON.stringify(distData));
		return;
	}

	console.log('');
	console.log(chalk.green.bold('Package path'));
	console.log(distData.pkgPath + '\n');
	console.log(chalk.green.bold('Tarball size'));
	console.log(getSize(distData.tarballSize) + '\n');

	const table = new SimpleTable();

	table.header(
		chalk.green('File'),
		{
			text: chalk.green('Size'),
			align: 'right',
		},
		{
			text: chalk.green('Gzip'),
			align: 'right',
		},
		{
			text: chalk.green('Brotli'),
			align: 'right',
		},
	);

	const total = {
		size: 0,
		sizeGzip: 0,
		sizeBrotli: 0,
	};

	distData.files
		.sort(compareFiles(sortBy))
		.forEach(file => {
			table.row(
				chalk.cyan(file.path),
				getSize(file.size),
				getSize(file.sizeGzip),
				getSize(file.sizeBrotli),
			);

			total.size += file.size;
			total.sizeGzip += file.sizeGzip;
			total.sizeBrotli += file.sizeBrotli;
		});

	table.row();

	table.row(
		'',
		chalk.underline(getSize(total.size)),
		chalk.underline(getSize(total.sizeGzip)),
		chalk.underline(getSize(total.sizeBrotli)),
	);

	console.log(table.toString() + '\n');
});

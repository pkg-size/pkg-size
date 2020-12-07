#!/usr/bin/env node

'use strict';

const meow = require('meow');
const SimpleTable = require('cli-simple-table');
const byteSize = require('byte-size');
const chalk = require('chalk');
const pkgSize = require('..');

const compareFiles = sortBy => (a, b) => b[sortBy] - a[sortBy];

const cli = meow(`
	Usage
	  $ pkg-size <pkg-path>

	Options
	  --sort-by, -s     Sort list by (name, size, gzip, brotli) (Default: brotli)
	  --unit, -u        Display units (metric, iec, metric_octet, iec_octet) (Default: metric)
	  --help            Show help
	  --version         Show version

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
	},
});

const sortByValues = {
	gzip: 'sizeGzip',
	brotli: 'sizeBrotli',
};

let {sortBy, unit} = cli.flags;

if (sortByValues[sortBy]) {
	sortBy = sortByValues[sortBy];
}

const byteSizeOptions = {
	units: unit,
};

const getSize = bytes => byteSize(bytes, byteSizeOptions);

pkgSize(cli.input[0]).then(distData => {
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

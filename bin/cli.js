#!/usr/bin/env node

'use strict';

const meow = require('meow');
const SimpleTable = require('cli-simple-table');
const filesize = require('filesize');
const chalk = require('chalk');
const pkgSize = require('..');

const compareFiles = sortBy => (a, b) => b[sortBy] - a[sortBy];

const cli = meow(`
	Usage
	  $ pkg-size <pkg-path>

	Options
	  --sort-by, -s     Sort list by (name, size, gzip, brotli)
	  --help            Show help
	  --version         Show version

	Examples
	  $ pkg-size
	  $ pkg-size ./pkg/path

	  $ pkg-size --sort-by=name
	  $ pkg-size -s brotli
`, {
	flags: {
		'sort-by': {
			type: 'string',
			alias: 's',
			default: 'brotli',
		},
	},
});

const sortByValues = {
	gzip: 'sizeGzip',
	brotli: 'sizeBrotli',
};

let {sortBy} = cli.flags;

if (sortByValues[sortBy]) {
	sortBy = sortByValues[sortBy];
}

pkgSize(cli.input[0]).then(distData => {
	const filesizeOpts = {
		standard: 'iec',
	};

	console.log('');
	console.log(chalk.green.bold('Package path'));
	console.log(distData.pkgPath + '\n');
	console.log(chalk.green.bold('Tarball size'));
	console.log(filesize(distData.tarballSize, filesizeOpts) + '\n');

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
				filesize(file.size, filesizeOpts),
				filesize(file.sizeGzip, filesizeOpts),
				filesize(file.sizeBrotli, filesizeOpts),
			);

			total.size += file.size;
			total.sizeGzip += file.sizeGzip;
			total.sizeBrotli += file.sizeBrotli;
		});

	table.row();

	table.row(
		'',
		chalk.underline(filesize(total.size, filesizeOpts)),
		chalk.underline(filesize(total.sizeGzip, filesizeOpts)),
		chalk.underline(filesize(total.sizeBrotli, filesizeOpts)),
	);

	console.log(table.toString() + '\n');
});

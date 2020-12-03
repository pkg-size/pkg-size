#!/usr/bin/env node

'use strict';

const meow = require('meow');
const SimpleTable = require('cli-simple-table');
const filesize = require('filesize');
const chalk = require('chalk');
const distsize = require('..');

const cli = meow(`
	Usage
	  $ distsize <pkg-path>

	Examples
	  $ distsize
	  $ distsize ./pkg/path
`);

distsize(cli.input[0]).then(distData => {
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

	distData.files.forEach(file => {
		table.row(
			chalk.cyan(file.path),
			filesize(file.size),
			filesize(file.sizeGzip),
			filesize(file.sizeBrotli),
		);

		total.size += file.size;
		total.sizeGzip += file.sizeGzip;
		total.sizeBrotli += file.sizeBrotli;
	});

	table.row();

	table.row(
		'',
		chalk.underline(filesize(total.size)),
		chalk.underline(filesize(total.sizeGzip)),
		chalk.underline(filesize(total.sizeBrotli)),
	);

	console.log(chalk.green.bold('\nPackage path'));
	console.log(distData.pkgPath + '\n');
	console.log(table.toString() + '\n');
});

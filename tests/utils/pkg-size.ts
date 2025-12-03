import path from 'node:path';
import spawn, { type SubprocessError } from 'nano-spawn';

const cliPath = path.resolve('./dist/cli.js');

export const pkgSizeCli = (
	cwd: string,
	args: string[] = [],
) => spawn(process.execPath, [cliPath, ...args], {
	cwd,
	env: {
		PATH: process.env.PATH,
	},
}).catch(error => error as SubprocessError);

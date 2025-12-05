import path from 'node:path';
import spawn, { type SubprocessError, type Result } from 'nano-spawn';

const cliPath = path.resolve('./dist/cli/index.js');

export type PkgSizeCli = (
	cwd: string,
	args?: string[],
) => Promise<Result | SubprocessError>;

export const createPkgSizeCli = (
	nodePath: string,
): PkgSizeCli => (
	cwd: string,
	args: string[] = [],
) => spawn(nodePath, [cliPath, ...args], {
	cwd,
	env: {
		PATH: process.env.PATH,
	},
}).catch(error => error as SubprocessError);

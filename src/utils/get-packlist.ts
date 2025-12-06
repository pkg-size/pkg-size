import packlist from 'npm-packlist';
import type { PackageJson } from 'type-fest';

// Required by npm-packlist but not used for our purposes
const edgesOut = new Map();

export const getPacklist = (
	path: string,
	packageJson: PackageJson,
) => packlist({
	path,
	package: packageJson,
	edgesOut,
});

import packlist from 'npm-packlist';
import type { PackageJson } from 'type-fest';

// Required by npm-packlist but not used for our purposes
const edgesOut = new Map();

export const getPacklist = (
	pkgPath: string,
	packageJson: PackageJson,
) => packlist({
	path: pkgPath,
	package: packageJson,
	edgesOut,
});

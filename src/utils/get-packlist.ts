import packlist from 'npm-packlist';

// Required by npm-packlist but not used for our purposes
const edgesOut = new Map();

export const getPacklist = (
	pkgPath: string,
	packageJson: Record<string, unknown>,
) => packlist({
	path: pkgPath,
	package: packageJson,
	edgesOut,
});

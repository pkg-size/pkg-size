import type { PackageJson } from 'type-fest';

export const definePackageJson = (
	packageJson: PackageJson,
): string => JSON.stringify(packageJson);

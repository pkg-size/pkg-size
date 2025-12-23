import type { InstalledPackage } from '../install/types.js';
import { getAuthorDisplayName } from './parse-author.js';

export const groupByOptions = ['scope', 'license', 'author', 'level'] as const;

export type GroupBy = typeof groupByOptions[number];

export type PackageGroup = {
	packages: InstalledPackage[];
	totalSize: number;
};

export const GroupByType = (value: string): GroupBy => {
	if (!groupByOptions.includes(value as GroupBy)) {
		throw new Error(`Invalid group: "${value}". Must be: ${groupByOptions.join(', ')}`);
	}
	return value as GroupBy;
};

const getScope = (packageName: string): string => {
	if (packageName.startsWith('@')) {
		const slashIndex = packageName.indexOf('/');
		if (slashIndex !== -1) {
			return packageName.slice(0, slashIndex);
		}
	}
	return '(unscoped)';
};

const getGroupKey = (
	pkg: InstalledPackage,
	groupBy: GroupBy,
): string => {
	if (groupBy === 'scope') {
		return getScope(pkg.name);
	}
	if (groupBy === 'license') {
		return pkg.license ?? '(unknown)';
	}
	if (groupBy === 'author') {
		return getAuthorDisplayName(pkg.author) ?? '(unknown)';
	}
	if (groupBy === 'level') {
		return String(pkg.level);
	}
	return '(unknown)';
};

export const groupPackages = (
	packages: InstalledPackage[],
	groupBy: GroupBy,
): Record<string, PackageGroup> => {
	const groups: Record<string, PackageGroup> = {};

	for (const pkg of packages) {
		const key = getGroupKey(pkg, groupBy);
		if (!groups[key]) {
			groups[key] = {
				packages: [],
				totalSize: 0,
			};
		}
		groups[key].packages.push(pkg);
		groups[key].totalSize += pkg.size;
	}

	return groups;
};

import type { InstalledPackage } from '../install/types.js';

export type SortDirection = 'asc' | 'desc';

export type SortCriterion = {
	property: keyof InstalledPackage;
	direction: SortDirection;
};

export type SortCriteria = SortCriterion[];

export const sortableProperties = [
	'name',
	'version',
	'size',
	'license',
	'author',
	'dependencySize',
	'dependencyCount',
] as const;

export type SortableProperty = typeof sortableProperties[number];

const isValidProperty = (value: string): value is SortableProperty => (
	sortableProperties.includes(value as SortableProperty)
);

const isValidDirection = (value: string): value is SortDirection => (
	value === 'asc' || value === 'desc'
);

export const defaultSortBy = 'size:desc,name:asc';

export const parseSortBy = (input: string): SortCriteria => {
	const parts = input.split(',').map(part => part.trim());
	const criteria: SortCriteria = [];

	for (const part of parts) {
		const [property, direction = 'asc'] = part.split(':').map(s => s.trim());

		if (!isValidProperty(property)) {
			throw new Error(`Invalid sort property: "${property}". Must be: ${sortableProperties.join(', ')}`);
		}

		if (!isValidDirection(direction)) {
			throw new Error(`Invalid sort direction: "${direction}". Must be: asc, desc`);
		}

		criteria.push({
			property,
			direction,
		});
	}

	return criteria;
};

// CLI type validator - validates input and returns the string (parsing happens later)
export const SortByType = (value: string): string => {
	// Validate by parsing (will throw if invalid)
	parseSortBy(value);
	return value;
};

const compareValues = (
	a: unknown,
	b: unknown,
	direction: SortDirection,
): number => {
	// Handle undefined values - sort them last regardless of direction
	if (a === undefined && b === undefined) {
		return 0;
	}
	if (a === undefined) {
		return 1;
	}
	if (b === undefined) {
		return -1;
	}

	let result: number;

	if (typeof a === 'number' && typeof b === 'number') {
		result = a - b;
	} else {
		// String comparison
		const aString = String(a);
		const bString = String(b);
		result = aString < bString ? -1 : (aString > bString ? 1 : 0);
	}

	return direction === 'desc' ? -result : result;
};

export const comparePackages = (criteria: SortCriteria) => (
	a: InstalledPackage,
	b: InstalledPackage,
): number => {
	for (const { property, direction } of criteria) {
		const result = compareValues(a[property], b[property], direction);
		if (result !== 0) {
			return result;
		}
	}
	return 0;
};

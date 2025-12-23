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

export const defaultSortBy: SortCriteria = [
	{ property: 'size', direction: 'desc' },
	{ property: 'name', direction: 'asc' },
];

export const parseSortBy = (input: string): SortCriteria => {
	const parts = input.split(',');
	const criteria: SortCriteria = [];

	for (const part of parts) {
		const [property, direction = 'asc'] = part.split(':');

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

// CLI type validator - parses and returns SortCriteria
export const SortByType = (value: string): SortCriteria => parseSortBy(value);

const compareValues = (
	a: unknown,
	b: unknown,
	direction: SortDirection,
	property: string,
): number => {
	// Nullish values always sort last, regardless of direction
	if (a == null && b == null) {
		return 0;
	}
	if (a == null) {
		return 1;
	}
	if (b == null) {
		return -1;
	}

	let result: number;

	if (typeof a === 'number' && typeof b === 'number') {
		result = a - b;
	} else if (property === 'version') {
		// Numeric-aware comparison: 2.0.0 < 10.0.0 (string sort would incorrectly order as 10 < 2)
		result = String(a).localeCompare(String(b), undefined, { numeric: true });
	} else {
		// Standard string comparison
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
		const result = compareValues(a[property], b[property], direction, property);
		if (result !== 0) {
			return result;
		}
	}
	return 0;
};

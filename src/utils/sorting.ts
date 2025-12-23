import type { InstalledPackage } from '../install/types.js';

const sortableProperties = [
	'name',
	'version',
	'size',
	'license',
	'author',
	'dependencySize',
	'dependencyCount',
] as const;

type SortableProperty = typeof sortableProperties[number];

type SortDirection = 'asc' | 'desc';

type SortCriterion = {
	property: SortableProperty;
	direction: SortDirection;
};

export type SortCriteria = SortCriterion[];

export const defaultSortBy: SortCriteria = [
	{
		property: 'size',
		direction: 'desc',
	},
	{
		property: 'name',
		direction: 'asc',
	},
];

export const SortByType = (input: string): SortCriteria => {
	// Trim handles quoted args with spaces: --sort-by="size:desc, name:asc"
	const parts = input.split(',').map(part => part.trim());
	const criteria: SortCriteria = [];

	for (const part of parts) {
		const [property, direction = 'asc'] = part.split(':').map(s => s.trim());

		if (!sortableProperties.includes(property as SortableProperty)) {
			throw new Error(`Invalid sort property: "${property}". Must be: ${sortableProperties.join(', ')}`);
		}

		if (direction !== 'asc' && direction !== 'desc') {
			throw new Error(`Invalid sort direction: "${direction}". Must be: asc, desc`);
		}

		criteria.push({
			property: property as SortableProperty,
			direction,
		});
	}

	return criteria;
};

const compareValues = (
	a: unknown,
	b: unknown,
	direction: SortDirection,
	property: string,
): number => {
	// Nullish values always sort last, regardless of direction
	const aIsNullish = a === null || a === undefined;
	const bIsNullish = b === null || b === undefined;
	if (aIsNullish && bIsNullish) {
		return 0;
	}
	if (aIsNullish) {
		return 1;
	}
	if (bIsNullish) {
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


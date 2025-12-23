import { testSuite, expect } from 'manten';
import {
	SortByType,
	comparePackages,
	applySortByGrouping,
	type SortCriteria,
} from '../../src/utils/sorting.js';
import type { InstalledPackage } from '../../src/install/types.js';

const createPackage = (overrides: Partial<InstalledPackage>): InstalledPackage => ({
	name: 'test-package',
	version: '1.0.0',
	size: 1000,
	files: [],
	installedBy: [],
	path: 'node_modules/test-package',
	dependencySize: 0,
	dependencyCount: 0,
	...overrides,
});

export default testSuite(({ describe }) => {
	describe('sorting', ({ describe }) => {
		describe('SortByType', ({ test }) => {
			test('parses single property with explicit direction', () => {
				const result = SortByType('size:desc');
				expect(result).toEqual([{
					property: 'size',
					direction: 'desc',
				}]);
			});

			test('parses single property with asc direction', () => {
				const result = SortByType('name:asc');
				expect(result).toEqual([{
					property: 'name',
					direction: 'asc',
				}]);
			});

			test('defaults to asc when direction is omitted', () => {
				const result = SortByType('size');
				expect(result).toEqual([{
					property: 'size',
					direction: 'asc',
				}]);
			});

			test('parses multiple properties', () => {
				const result = SortByType('size:desc,name:asc');
				expect(result).toEqual([
					{
						property: 'size',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]);
			});

			test('parses multiple properties with mixed explicit/implicit directions', () => {
				const result = SortByType('size:desc,name');
				expect(result).toEqual([
					{
						property: 'size',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]);
			});

			test('parses all sortable properties', () => {
				const properties = [
					'name',
					'version',
					'size',
					'license',
					'author',
					'dependencySize',
					'dependencyCount',
				];

				for (const property of properties) {
					const result = SortByType(property);
					expect(result).toEqual([{
						property,
						direction: 'asc',
					}]);
				}
			});

			test('throws on invalid property', () => {
				expect(() => SortByType('invalid')).toThrow('Invalid sort property: "invalid"');
			});

			test('throws on invalid direction', () => {
				expect(() => SortByType('size:up')).toThrow('Invalid sort direction: "up"');
			});

			test('handles whitespace around values', () => {
				const result = SortByType(' size:desc , name:asc ');
				expect(result).toEqual([
					{
						property: 'size',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]);
			});
		});

		describe('comparePackages', ({ test }) => {
			test('sorts by single property ascending', () => {
				const packages = [
					createPackage({
						name: 'large',
						size: 3000,
					}),
					createPackage({
						name: 'small',
						size: 1000,
					}),
					createPackage({
						name: 'medium',
						size: 2000,
					}),
				];

				packages.sort(comparePackages([{
					property: 'size',
					direction: 'asc',
				}]));

				expect(packages.map(p => p.name)).toEqual(['small', 'medium', 'large']);
			});

			test('sorts by single property descending', () => {
				const criteria: SortCriteria = [{
					property: 'size',
					direction: 'desc',
				}];
				const packages = [
					createPackage({
						name: 'small',
						size: 1000,
					}),
					createPackage({
						name: 'large',
						size: 3000,
					}),
					createPackage({
						name: 'medium',
						size: 2000,
					}),
				];

				packages.sort(comparePackages(criteria));

				expect(packages.map(p => p.name)).toEqual(['large', 'medium', 'small']);
			});

			test('sorts by name ascending (alphabetical)', () => {
				const criteria: SortCriteria = [{
					property: 'name',
					direction: 'asc',
				}];
				const packages = [
					createPackage({ name: 'zebra' }),
					createPackage({ name: 'alpha' }),
					createPackage({ name: 'mango' }),
				];

				packages.sort(comparePackages(criteria));

				expect(packages.map(p => p.name)).toEqual(['alpha', 'mango', 'zebra']);
			});

			test('sorts by name descending (reverse alphabetical)', () => {
				const criteria: SortCriteria = [{
					property: 'name',
					direction: 'desc',
				}];
				const packages = [
					createPackage({ name: 'alpha' }),
					createPackage({ name: 'zebra' }),
					createPackage({ name: 'mango' }),
				];

				packages.sort(comparePackages(criteria));

				expect(packages.map(p => p.name)).toEqual(['zebra', 'mango', 'alpha']);
			});

			test('uses secondary sort for ties', () => {
				const packages = [
					createPackage({
						name: 'charlie',
						size: 1000,
					}),
					createPackage({
						name: 'alpha',
						size: 1000,
					}),
					createPackage({
						name: 'bravo',
						size: 1000,
					}),
				];

				packages.sort(comparePackages([
					{
						property: 'size',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]));

				// Same size, so sorted by name ascending
				expect(packages.map(p => p.name)).toEqual(['alpha', 'bravo', 'charlie']);
			});

			test('primary sort takes precedence over secondary', () => {
				const packages = [
					createPackage({
						name: 'alpha',
						size: 1000,
					}),
					createPackage({
						name: 'bravo',
						size: 3000,
					}),
					createPackage({
						name: 'charlie',
						size: 2000,
					}),
				];

				packages.sort(comparePackages([
					{
						property: 'size',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]));

				// Size desc takes precedence
				expect(packages.map(p => p.name)).toEqual(['bravo', 'charlie', 'alpha']);
			});

			test('sorts by version with numeric awareness', () => {
				const packages = [
					createPackage({
						name: 'a',
						version: '2.0.0',
					}),
					createPackage({
						name: 'b',
						version: '1.0.0',
					}),
					createPackage({
						name: 'c',
						version: '10.0.0',
					}),
				];

				packages.sort(comparePackages([{
					property: 'version',
					direction: 'asc',
				}]));

				// Numeric sort: 1.0.0 < 2.0.0 < 10.0.0
				expect(packages.map(p => p.version)).toEqual(['1.0.0', '2.0.0', '10.0.0']);
			});

			test('sorts by dependencySize', () => {
				const packages = [
					createPackage({
						name: 'small-deps',
						dependencySize: 100,
					}),
					createPackage({
						name: 'large-deps',
						dependencySize: 5000,
					}),
					createPackage({
						name: 'medium-deps',
						dependencySize: 1000,
					}),
				];

				packages.sort(comparePackages([{
					property: 'dependencySize',
					direction: 'desc',
				}]));

				expect(packages.map(p => p.name)).toEqual(['large-deps', 'medium-deps', 'small-deps']);
			});

			test('sorts by dependencyCount', () => {
				const packages = [
					createPackage({
						name: 'few-deps',
						dependencyCount: 2,
					}),
					createPackage({
						name: 'many-deps',
						dependencyCount: 50,
					}),
					createPackage({
						name: 'some-deps',
						dependencyCount: 10,
					}),
				];

				packages.sort(comparePackages([{
					property: 'dependencyCount',
					direction: 'desc',
				}]));

				expect(packages.map(p => p.name)).toEqual(['many-deps', 'some-deps', 'few-deps']);
			});

			test('handles undefined - sorts last in ascending', () => {
				const packages = [
					createPackage({
						name: 'mit',
						license: 'MIT',
					}),
					createPackage({
						name: 'none',
						license: undefined,
					}),
					createPackage({
						name: 'isc',
						license: 'ISC',
					}),
				];

				packages.sort(comparePackages([{
					property: 'license',
					direction: 'asc',
				}]));

				// undefined should sort last regardless of direction
				expect(packages.map(p => p.name)).toEqual(['isc', 'mit', 'none']);
			});

			test('handles undefined - sorts last in descending', () => {
				const packages = [
					createPackage({
						name: 'mit',
						license: 'MIT',
					}),
					createPackage({
						name: 'none',
						license: undefined,
					}),
					createPackage({
						name: 'isc',
						license: 'ISC',
					}),
				];

				packages.sort(comparePackages([{
					property: 'license',
					direction: 'desc',
				}]));

				// undefined should sort last regardless of direction (nulls last)
				expect(packages.map(p => p.name)).toEqual(['mit', 'isc', 'none']);
			});

			test('handles three-level sort criteria', () => {
				const packages = [
					createPackage({
						name: 'c',
						size: 1000,
						dependencyCount: 5,
					}),
					createPackage({
						name: 'a',
						size: 1000,
						dependencyCount: 5,
					}),
					createPackage({
						name: 'b',
						size: 1000,
						dependencyCount: 5,
					}),
					createPackage({
						name: 'd',
						size: 1000,
						dependencyCount: 3,
					}),
				];

				packages.sort(comparePackages([
					{
						property: 'size',
						direction: 'desc',
					},
					{
						property: 'dependencyCount',
						direction: 'asc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]));

				// All same size, so by dependencyCount asc, then name asc
				expect(packages.map(p => p.name)).toEqual(['d', 'a', 'b', 'c']);
			});
		});

		describe('applySortByGrouping', ({ test }) => {
			test('prepends groupBy property with asc when not in sortBy', () => {
				const result = applySortByGrouping([
					{
						property: 'size',
						direction: 'desc',
					},
				], 'author');

				expect(result).toEqual([
					{
						property: 'author',
						direction: 'asc',
					},
					{
						property: 'size',
						direction: 'desc',
					},
				]);
			});

			test('keeps user-specified direction when groupBy matches first sortBy', () => {
				const result = applySortByGrouping([
					{
						property: 'author',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				], 'author');

				// Should not modify - user already specified author first
				expect(result).toEqual([
					{
						property: 'author',
						direction: 'desc',
					},
					{
						property: 'name',
						direction: 'asc',
					},
				]);
			});

			test('returns sortBy unchanged when groupBy is undefined', () => {
				const sortBy: SortCriteria = [
					{
						property: 'size',
						direction: 'desc',
					},
				];

				const result = applySortByGrouping(sortBy, undefined);

				expect(result).toEqual(sortBy);
			});

			test('works with scope grouping', () => {
				// scope maps to 'name' for sorting (scoped packages sort by name)
				const result = applySortByGrouping([
					{
						property: 'size',
						direction: 'desc',
					},
				], 'scope');

				expect(result).toEqual([
					{
						property: 'name',
						direction: 'asc',
					},
					{
						property: 'size',
						direction: 'desc',
					},
				]);
			});
		});
	});
});

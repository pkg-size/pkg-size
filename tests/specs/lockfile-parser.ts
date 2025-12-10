import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { parseLockfile, buildDependencyPathFromGraph } from '../../src/install/utils/lockfile.js';
import type { PackageReference } from '../../src/install/types.js';

type DependencyGraph = Map<string, PackageReference[]>;

export default testSuite(({ describe }) => {
	describe('lockfile-parser', ({ describe }) => {
		describe('buildDependencyPathFromGraph', ({ test }) => {
			test('returns empty path for direct dependency (no parents)', () => {
				// is-odd has no parents → direct dependency
				const graph: DependencyGraph = new Map([
					['is-odd', []],
				]);

				const result = buildDependencyPathFromGraph('is-odd', graph);

				expect(result).toEqual([]);
			});

			test('returns empty path for package not in graph', () => {
				const graph: DependencyGraph = new Map();

				const result = buildDependencyPathFromGraph('unknown-pkg', graph);

				expect(result).toEqual([]);
			});

			test('builds single-level path for transitive dependency', () => {
				// is-number is required by is-odd
				const graph: DependencyGraph = new Map([
					['is-odd', []],
					['is-number', [{
						name: 'is-odd',
						version: '3.0.1',
					}]],
				]);

				const result = buildDependencyPathFromGraph('is-number', graph);

				expect(result).toEqual([{
					name: 'is-odd',
					version: '3.0.1',
				}]);
			});

			test('builds multi-level path for deeply nested dependency', () => {
				// level-3 → level-2 → level-1 → root
				const graph: DependencyGraph = new Map([
					['level-1', []],
					['level-2', [{
						name: 'level-1',
						version: '1.0.0',
					}]],
					['level-3', [{
						name: 'level-2',
						version: '2.0.0',
					}]],
				]);

				const result = buildDependencyPathFromGraph('level-3', graph);

				// Path should be from root to parent: [level-1, level-2]
				expect(result).toEqual([
					{
						name: 'level-1',
						version: '1.0.0',
					},
					{
						name: 'level-2',
						version: '2.0.0',
					},
				]);
			});

			test('uses first parent when package has multiple parents', () => {
				// shared-dep is required by both pkg-a and pkg-b
				const graph: DependencyGraph = new Map([
					['pkg-a', []],
					['pkg-b', []],
					['shared-dep', [
						{
							name: 'pkg-a',
							version: '1.0.0',
						},
						{
							name: 'pkg-b',
							version: '2.0.0',
						},
					]],
				]);

				const result = buildDependencyPathFromGraph('shared-dep', graph);

				// Uses first parent
				expect(result).toEqual([{
					name: 'pkg-a',
					version: '1.0.0',
				}]);
			});

			test('handles cycles gracefully', () => {
				// Circular: a → b → a
				const graph: DependencyGraph = new Map([
					['pkg-a', [{
						name: 'pkg-b',
						version: '1.0.0',
					}]],
					['pkg-b', [{
						name: 'pkg-a',
						version: '1.0.0',
					}]],
				]);

				const result = buildDependencyPathFromGraph('pkg-a', graph);

				// Should not infinite loop, returns partial path
				expect(result.length).toBeLessThanOrEqual(2);
			});

			test('handles scoped package names', () => {
				const graph: DependencyGraph = new Map([
					['@scope/parent', []],
					['child', [{
						name: '@scope/parent',
						version: '1.0.0',
					}]],
				]);

				const result = buildDependencyPathFromGraph('child', graph);

				expect(result).toEqual([{
					name: '@scope/parent',
					version: '1.0.0',
				}]);
			});
		});

		describe('parseLockfile', ({ test }) => {
			test('returns undefined when no lockfile exists', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
					}),
				});

				const result = await parseLockfile(fixture.path);

				expect(result).toBeUndefined();
			});

			test('parses npm package-lock.json v3 format', async () => {
				// npm lockfile v3 uses "node_modules/pkg" keys
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
					}),
					'package-lock.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
						lockfileVersion: 3,
						packages: {
							'': {
								name: 'test',
								version: '1.0.0',
								dependencies: {
									'is-odd': '^3.0.0',
								},
							},
							'node_modules/is-odd': {
								version: '3.0.1',
								dependencies: {
									'is-number': '^6.0.0',
								},
							},
							'node_modules/is-number': {
								version: '6.0.0',
							},
						},
					}),
				});

				const graph = await parseLockfile(fixture.path);

				expect(graph).toBeDefined();
				// is-odd is direct dep (from root "")
				expect(graph!.get('is-odd')).toEqual([]);
				// is-number is transitive (from is-odd)
				expect(graph!.get('is-number')).toEqual([
					{
						name: 'is-odd',
						version: '3.0.1',
					},
				]);
			});

			test('handles scoped packages in lockfile', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
					}),
					'package-lock.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
						lockfileVersion: 3,
						packages: {
							'': {
								dependencies: {
									'@scope/pkg': '^1.0.0',
								},
							},
							'node_modules/@scope/pkg': {
								version: '1.0.0',
								dependencies: {
									'child-dep': '^1.0.0',
								},
							},
							'node_modules/child-dep': {
								version: '1.0.0',
							},
						},
					}),
				});

				const graph = await parseLockfile(fixture.path);

				expect(graph).toBeDefined();
				expect(graph!.get('@scope/pkg')).toEqual([]);
				expect(graph!.get('child-dep')).toEqual([
					{
						name: '@scope/pkg',
						version: '1.0.0',
					},
				]);
			});

			test('handles packages with no dependencies', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
					}),
					'package-lock.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
						lockfileVersion: 3,
						packages: {
							'': {
								dependencies: {
									'leaf-pkg': '^1.0.0',
								},
							},
							'node_modules/leaf-pkg': {
								version: '1.0.0',
								// No dependencies field
							},
						},
					}),
				});

				const graph = await parseLockfile(fixture.path);

				expect(graph).toBeDefined();
				// leaf-pkg has no deps, so only root's dep is recorded
				expect(graph!.get('leaf-pkg')).toEqual([]);
			});

			test('handles lockfile v1 format (npm 6)', async () => {
				// npm lockfile v1 also uses "node_modules/" prefix in packages
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
					}),
					'package-lock.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
						lockfileVersion: 1,
						packages: {
							'': {
								dependencies: {
									'some-pkg': '^1.0.0',
								},
							},
							'node_modules/some-pkg': {
								version: '1.0.0',
							},
						},
					}),
				});

				const graph = await parseLockfile(fixture.path);

				expect(graph).toBeDefined();
				expect(graph!.get('some-pkg')).toEqual([]);
			});

			test('handles empty packages object', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
					}),
					'package-lock.json': JSON.stringify({
						name: 'test',
						version: '1.0.0',
						lockfileVersion: 3,
						packages: {},
					}),
				});

				const graph = await parseLockfile(fixture.path);

				expect(graph).toBeDefined();
				expect(graph!.size).toBe(0);
			});
		});
	});
});

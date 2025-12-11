import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { crawlNodeModulesOnce } from '../../src/install/utils/scanner.js';

export default testSuite(({ describe }) => {
	describe('package-utils', ({ describe }) => {
		describe('crawlNodeModulesOnce', ({ test }) => {
			test('buckets files by regular package name', async () => {
				await using fixture = await createFixture({
					node_modules: {
						lodash: {
							'package.json': '{}',
							'index.js': 'module.exports = {}',
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				expect(result.has('lodash')).toBe(true);
				const lodash = result.get('lodash')!;
				expect(lodash.files).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ path: 'package.json' }),
						expect.objectContaining({ path: 'index.js' }),
					]),
				);
				expect(lodash.files.length).toBe(2);
			});

			test('buckets files by scoped package name', async () => {
				await using fixture = await createFixture({
					node_modules: {
						'@types': {
							node: {
								'package.json': '{}',
								'index.d.ts': 'export {}',
							},
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				expect(result.has('@types/node')).toBe(true);
				const typesNode = result.get('@types/node')!;
				expect(typesNode.files).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ path: 'package.json' }),
						expect.objectContaining({ path: 'index.d.ts' }),
					]),
				);
			});

			test('handles deeply nested files in packages', async () => {
				await using fixture = await createFixture({
					node_modules: {
						lodash: {
							'package.json': '{}',
							dist: {
								'lodash.min.js': 'minified',
								esm: {
									'index.js': 'export {}',
								},
							},
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				const lodash = result.get('lodash')!;
				expect(lodash.files).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ path: 'package.json' }),
						expect.objectContaining({ path: 'dist/lodash.min.js' }),
						expect.objectContaining({ path: 'dist/esm/index.js' }),
					]),
				);
			});

			test('skips hidden directories (.bin, .cache)', async () => {
				await using fixture = await createFixture({
					node_modules: {
						'.bin': {
							'some-binary': '#!/bin/sh',
						},
						'.cache': {
							'cached-file': 'data',
						},
						lodash: {
							'package.json': '{}',
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				// .bin and .cache should not appear as packages
				expect(result.has('.bin')).toBe(false);
				expect(result.has('.cache')).toBe(false);
				// But lodash should
				expect(result.has('lodash')).toBe(true);
			});

			test('calculates correct total size per package', async () => {
				const file1Content = 'x'.repeat(100);
				const file2Content = 'y'.repeat(200);

				await using fixture = await createFixture({
					node_modules: {
						'test-pkg': {
							'file1.js': file1Content,
							'file2.js': file2Content,
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				const testPkg = result.get('test-pkg')!;
				expect(testPkg.size).toBe(300); // 100 + 200
			});

			test('handles multiple packages', async () => {
				await using fixture = await createFixture({
					node_modules: {
						'pkg-a': {
							'package.json': '{}',
						},
						'pkg-b': {
							'package.json': '{}',
						},
						'@scope': {
							'pkg-c': {
								'package.json': '{}',
							},
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				expect(result.has('pkg-a')).toBe(true);
				expect(result.has('pkg-b')).toBe(true);
				expect(result.has('@scope/pkg-c')).toBe(true);
				expect(result.size).toBe(3);
			});

			test('returns empty map for empty node_modules', async () => {
				await using fixture = await createFixture({
					node_modules: {},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				expect(result.size).toBe(0);
			});

			test('excludes nested node_modules from package size', async () => {
				await using fixture = await createFixture({
					node_modules: {
						'parent-pkg': {
							'package.json': '{}', // ~2 bytes
							'index.js': 'x'.repeat(50),
							node_modules: {
								'child-pkg': {
									'package.json': '{}',
									'large-file.js': 'x'.repeat(10_000),
								},
							},
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				const parentPkg = result.get('parent-pkg')!;
				// Parent should NOT include nested node_modules
				// Should be ~52 bytes (2 + 50), not 10,000+
				expect(parentPkg.size).toBeLessThan(100);
			});

			test('handles files at scope level (edge case)', async () => {
				// Files directly under @scope (not in a package) should be skipped
				await using fixture = await createFixture({
					node_modules: {
						'@scope': {
							'stray-file.txt': 'orphan',
							'valid-pkg': {
								'package.json': '{}',
							},
						},
					},
				});

				const result = await crawlNodeModulesOnce(`${fixture.path}/node_modules`);

				// Should only have the valid package, not the stray file
				expect(result.has('@scope/valid-pkg')).toBe(true);
				expect(result.size).toBe(1);
			});
		});
	});
});

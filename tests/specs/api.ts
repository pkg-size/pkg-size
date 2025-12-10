import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { getPackageSize, getInstallSize, analyzeNodeModules } from '../../src/index.js';
import { detectPackageManager } from '../../src/utils/package-manager.js';
import { definePackageJson } from '../utils/package-json.js';

export default testSuite(({ describe }) => {
	describe('API', ({ describe }) => {
		describe('Local Mode', ({ test }) => {
			test('returns package size data', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'module.exports = "hello";',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size', 'gzip', 'brotli'],
				});

				expect(result.packagePath).toBe(fixture.path);
				expect(typeof result.tarballSize).toBe('number');
				expect(result.tarballSize).toBeGreaterThan(0);
				expect(Array.isArray(result.files)).toBe(true);
				expect(result.files.length).toBe(2);
			});

			test('calculates file sizes correctly', async () => {
				const content = 'x'.repeat(1000);

				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'data.txt': content,
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size', 'gzip', 'brotli'],
				});

				const dataFile = result.files.find(file => file.path === 'data.txt');
				expect(dataFile).toBeDefined();
				expect(dataFile!.size).toBe(1000);
				expect(dataFile!.sizeGzip).toBeLessThan(dataFile!.size);
				expect(dataFile!.sizeBrotli).toBeLessThan(dataFile!.size);
			});

			test('respects .npmignore', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'module.exports = 1;',
					'ignored.js': 'ignored content',
					'.npmignore': 'ignored.js',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				const ignoredFile = result.files.find(file => file.path === 'ignored.js');
				expect(ignoredFile).toBeUndefined();
			});

			test('respects files field in package.json', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
						files: ['dist'],
					}),
					'src/index.js': 'source',
					'dist/index.js': 'built',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				const srcFile = result.files.find(file => file.path === 'src/index.js');
				const distFile = result.files.find(file => file.path === 'dist/index.js');
				expect(srcFile).toBeUndefined();
				expect(distFile).toBeDefined();
			});

			test('supports ignoreFiles option', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'main',
					'types.d.ts': 'types',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
					ignoreFiles: '*.d.ts',
				});

				const typesFile = result.files.find(file => file.path === 'types.d.ts');
				expect(typesFile).toBeUndefined();
			});

			test('calculates only requested sizes', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				const indexFile = result.files.find(file => file.path === 'index.js');
				expect(indexFile!.size).toBeGreaterThan(0);
				expect(indexFile!.sizeGzip).toBe(0);
				expect(indexFile!.sizeBrotli).toBe(0);
			});

			test('works without options', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path);

				expect(result.packagePath).toBe(fixture.path);
				expect(result.tarballSize).toBeGreaterThan(0);
				expect(result.files.length).toBe(2);
			});

			test('tarball is gzip compressed', async () => {
				const largeContent = 'x'.repeat(10_000);

				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'large.txt': largeContent,
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				const largeFile = result.files.find(file => file.path === 'large.txt');
				// Tarball should be smaller than uncompressed file due to gzip
				expect(result.tarballSize).toBeLessThan(largeFile!.size);
			});

			test('returns privatePackage: true for private packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
						private: true,
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				expect(result.privatePackage).toBe(true);
			});

			test('returns privatePackage: false for public packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				expect(result.privatePackage).toBe(false);
			});

			test('handles package with only package.json', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				expect(result.files.length).toBe(1);
				expect(result.files[0].path).toBe('package.json');
			});

			test('handles empty files array in package.json', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
						files: [],
					}),
					'index.js': 'should be excluded',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				// package.json is always included by npm
				expect(result.files.length).toBe(1);
				expect(result.files[0].path).toBe('package.json');
			});

			test('handles .npmignore that excludes all files', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					'index.js': 'content',
					'.npmignore': '*\n!package.json',
				});

				const result = await getPackageSize(fixture.path, {
					sizes: ['size'],
				});

				// package.json is always included
				expect(result.files.length).toBe(1);
				expect(result.files[0].path).toBe('package.json');
			});

			test('throws on corrupt package.json', async () => {
				await using fixture = await createFixture({
					'package.json': '{ invalid json }',
				});

				const packageJsonPath = fixture.getPath('package.json');
				await expect(getPackageSize(fixture.path)).rejects.toThrow(
					`Failed to parse ${packageJsonPath}:`,
				);
			});
		});

		describe('Install Mode', ({ test }) => {
			test('returns install size data', async () => {
				const result = await getInstallSize('is-odd', {
					packageManager: 'pnpm',
				});

				expect(result.packageManager).toBe('pnpm');
				expect(result.totalSize).toBeGreaterThan(0);
				expect(result.installTime).toBeGreaterThan(0);
				expect(result.packages).toHaveLength(2);

				const isOdd = result.packages.find(pkg => pkg.name === 'is-odd');
				const isNumber = result.packages.find(pkg => pkg.name === 'is-number');

				expect(isOdd).toBeDefined();
				expect(isOdd!.version).toBeDefined();
				expect(isOdd!.size).toBeGreaterThan(0);
				expect(isOdd!.license).toBe('MIT');
				expect(isOdd!.installedBy).toEqual([]);

				expect(isNumber).toBeDefined();
				expect(isNumber!.version).toBeDefined();
				expect(isNumber!.size).toBeGreaterThan(0);
				expect(isNumber!.license).toBe('MIT');
				expect(isNumber!.installedBy).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
			});

			test('accepts space-delimited packages', async () => {
				const result = await getInstallSize('is-odd is-even', {
					packageManager: 'pnpm',
				});

				const packageNames = result.packages.map(pkg => pkg.name);
				expect(packageNames).toContain('is-odd');
				expect(packageNames).toContain('is-even');
			});

			test('detectPackageManager returns npm by default', () => {
				const originalAgent = process.env.npm_config_user_agent;
				delete process.env.npm_config_user_agent;

				expect(detectPackageManager()).toBe('npm');

				if (originalAgent !== undefined) {
					process.env.npm_config_user_agent = originalAgent;
				}
			});

			test('detectPackageManager detects pnpm', () => {
				const originalAgent = process.env.npm_config_user_agent;
				process.env.npm_config_user_agent = 'pnpm/10.24.0 npm/? node/v22.0.0';

				expect(detectPackageManager()).toBe('pnpm');

				if (originalAgent === undefined) {
					delete process.env.npm_config_user_agent;
				} else {
					process.env.npm_config_user_agent = originalAgent;
				}
			});

			test('detectPackageManager detects yarn', () => {
				const originalAgent = process.env.npm_config_user_agent;
				process.env.npm_config_user_agent = 'yarn/4.0.0 npm/? node/v22.0.0';

				expect(detectPackageManager()).toBe('yarn');

				if (originalAgent === undefined) {
					delete process.env.npm_config_user_agent;
				} else {
					process.env.npm_config_user_agent = originalAgent;
				}
			});

			test('npm returns transitive dependency paths', async () => {
				const result = await getInstallSize('is-odd', {
					packageManager: 'npm',
				});

				// is-odd depends on is-number, so is-number should have is-odd in its path
				const isNumber = result.packages.find(pkg => pkg.name === 'is-number');
				const isOdd = result.packages.find(pkg => pkg.name === 'is-odd');

				expect(isOdd).toBeDefined();
				expect(isOdd!.installedBy).toEqual([]);

				expect(isNumber).toBeDefined();
				expect(isNumber!.installedBy).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
			}, 30_000);

			test('pnpm returns transitive dependency paths', async () => {
				const result = await getInstallSize('is-odd', {
					packageManager: 'pnpm',
				});

				// is-odd depends on is-number, so is-number should have is-odd in its path
				const isNumber = result.packages.find(pkg => pkg.name === 'is-number');
				const isOdd = result.packages.find(pkg => pkg.name === 'is-odd');

				expect(isOdd).toBeDefined();
				expect(isOdd!.installedBy).toEqual([]);

				expect(isNumber).toBeDefined();
				expect(isNumber!.installedBy).toEqual([
					{
						name: 'is-odd',
						version: expect.any(String),
					},
				]);
			}, 30_000);
		});

		describe('Scan Mode', ({ test }) => {
			test('returns node_modules analysis', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'some-package': {
							'package.json': definePackageJson({
								name: 'some-package',
								version: '1.0.0',
							}),
							'index.js': 'module.exports = 1;',
						},
						'another-package': {
							'package.json': definePackageJson({
								name: 'another-package',
								version: '2.0.0',
							}),
							'lib.js': 'export default 2;',
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);

				expect(result.packages.length).toBe(2);
				expect(result.totalSize).toBeGreaterThan(0);

				const somePkg = result.packages.find(pkg => pkg.name === 'some-package');
				const anotherPkg = result.packages.find(pkg => pkg.name === 'another-package');

				expect(somePkg).toBeDefined();
				expect(somePkg?.version).toBe('1.0.0');
				expect(somePkg?.size).toBeGreaterThan(0);

				expect(anotherPkg).toBeDefined();
				expect(anotherPkg?.version).toBe('2.0.0');
				expect(anotherPkg?.size).toBeGreaterThan(0);
			});

			test('handles scoped packages', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'@scope': {
							'scoped-pkg': {
								'package.json': definePackageJson({
									name: '@scope/scoped-pkg',
									version: '1.0.0',
								}),
								'index.js': 'content',
							},
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);

				expect(result.packages.length).toBe(1);
				expect(result.packages[0].name).toBe('@scope/scoped-pkg');
				expect(result.packages[0].version).toBe('1.0.0');
				expect(result.packages[0].size).toBeGreaterThan(0);
				expect(result.totalSize).toBeGreaterThan(0);
			});

			test('returns empty packages when no node_modules', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
				});

				const result = await analyzeNodeModules(fixture.path);

				expect(result).toEqual({
					packages: [],
					totalSize: 0,
				});
			});

			test('extracts license metadata from package.json', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'mit-package': {
							'package.json': definePackageJson({
								name: 'mit-package',
								version: '1.0.0',
								license: 'MIT',
							}),
							'index.js': 'content',
						},
						'isc-package': {
							'package.json': definePackageJson({
								name: 'isc-package',
								version: '1.0.0',
								license: 'ISC',
							}),
							'index.js': 'content',
						},
						'no-license': {
							'package.json': definePackageJson({
								name: 'no-license',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);

				const mitPkg = result.packages.find(pkg => pkg.name === 'mit-package');
				const iscPkg = result.packages.find(pkg => pkg.name === 'isc-package');
				const noLicensePkg = result.packages.find(pkg => pkg.name === 'no-license');

				expect(mitPkg?.license).toBe('MIT');
				expect(iscPkg?.license).toBe('ISC');
				expect(noLicensePkg?.license).toBeUndefined();
			});

			test('normalizes legacy license formats', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'object-license': {
							// Legacy format: license as object (not typed in modern PackageJson)
							'package.json': JSON.stringify({
								name: 'object-license',
								version: '1.0.0',
								license: {
									type: 'MIT',
									url: 'https://opensource.org/licenses/MIT',
								},
							}),
							'index.js': 'content',
						},
						'licenses-array': {
							'package.json': definePackageJson({
								name: 'licenses-array',
								version: '1.0.0',
								licenses: [
									{
										type: 'MIT',
										url: 'https://opensource.org/licenses/MIT',
									},
									{
										type: 'Apache-2.0',
										url: 'https://opensource.org/licenses/Apache-2.0',
									},
								],
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);

				const objectLicensePkg = result.packages.find(pkg => pkg.name === 'object-license');
				const licensesArrayPkg = result.packages.find(pkg => pkg.name === 'licenses-array');

				expect(objectLicensePkg?.license).toBe('MIT');
				expect(licensesArrayPkg?.license).toBe('MIT, Apache-2.0');
			});

			test('extracts author metadata from package.json string format', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'string-author': {
							'package.json': definePackageJson({
								name: 'string-author',
								version: '1.0.0',
								author: 'John Doe <john@example.com>',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);
				const pkg = result.packages.find(p => p.name === 'string-author');

				expect(pkg?.author).toBe('John Doe <john@example.com>');
			});

			test('extracts author metadata from package.json object format', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'object-author': {
							'package.json': definePackageJson({
								name: 'object-author',
								version: '1.0.0',
								author: {
									name: 'Jane Smith',
									email: 'jane@example.com',
								},
							}),
							'index.js': 'content',
						},
						'object-author-no-email': {
							'package.json': definePackageJson({
								name: 'object-author-no-email',
								version: '1.0.0',
								author: {
									name: 'Bob',
								},
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);
				const withEmail = result.packages.find(p => p.name === 'object-author');
				const noEmail = result.packages.find(p => p.name === 'object-author-no-email');

				expect(withEmail?.author).toBe('Jane Smith <jane@example.com>');
				expect(noEmail?.author).toBe('Bob');
			});

			test('handles missing author metadata', async () => {
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'no-author': {
							'package.json': definePackageJson({
								name: 'no-author',
								version: '1.0.0',
							}),
							'index.js': 'content',
						},
					},
				});

				const result = await analyzeNodeModules(fixture.path);
				const pkg = result.packages.find(p => p.name === 'no-author');

				expect(pkg?.author).toBeUndefined();
			});

			test('builds path array from nested node_modules (auto-detected)', async () => {
				// Creates nested node_modules structure - auto-detection finds it
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'parent-pkg': {
							'package.json': definePackageJson({
								name: 'parent-pkg',
								version: '1.0.0',
							}),
							'index.js': 'content',
							node_modules: {
								'child-pkg': {
									'package.json': definePackageJson({
										name: 'child-pkg',
										version: '2.0.0',
									}),
									'index.js': 'content',
								},
							},
						},
					},
				});

				// No package manager specified - auto-detects nested structure
				const result = await analyzeNodeModules(fixture.path);

				const parentPkg = result.packages.find(p => p.name === 'parent-pkg');
				const childPkg = result.packages.find(p => p.name === 'child-pkg');

				// Parent is direct dependency (installedBy is empty)
				expect(parentPkg).toBeDefined();
				expect(parentPkg!.installedBy).toEqual([]);

				// Child is transitive dependency of parent
				expect(childPkg).toBeDefined();
				expect(childPkg!.installedBy).toEqual([
					{
						name: 'parent-pkg',
						version: '1.0.0',
					},
				]);
			});

			test('builds deep path array for deeply nested packages', async () => {
				// 3 levels of nesting: level-1 → level-2 → level-3
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'level-1': {
							'package.json': definePackageJson({
								name: 'level-1',
								version: '1.0.0',
							}),
							'index.js': 'content',
							node_modules: {
								'level-2': {
									'package.json': definePackageJson({
										name: 'level-2',
										version: '2.0.0',
									}),
									'index.js': 'content',
									node_modules: {
										'level-3': {
											'package.json': definePackageJson({
												name: 'level-3',
												version: '3.0.0',
											}),
											'index.js': 'content',
										},
									},
								},
							},
						},
					},
				});

				// No package manager - auto-detects nested structure
				const result = await analyzeNodeModules(fixture.path);

				const level1 = result.packages.find(p => p.name === 'level-1');
				const level2 = result.packages.find(p => p.name === 'level-2');
				const level3 = result.packages.find(p => p.name === 'level-3');

				// level-1: direct dependency (empty installedBy)
				expect(level1!.installedBy).toEqual([]);
				// level-2: transitive via level-1
				expect(level2!.installedBy).toEqual([
					{
						name: 'level-1',
						version: '1.0.0',
					},
				]);
				// level-3: transitive via level-1 → level-2
				expect(level3!.installedBy).toEqual([
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

			test('handles nested scoped packages', async () => {
				// Scoped package @scope/parent-pkg with nested child-pkg
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'@scope': {
							'parent-pkg': {
								'package.json': definePackageJson({
									name: '@scope/parent-pkg',
									version: '1.0.0',
								}),
								'index.js': 'content',
								node_modules: {
									'child-pkg': {
										'package.json': definePackageJson({
											name: 'child-pkg',
											version: '2.0.0',
										}),
										'index.js': 'content',
									},
								},
							},
						},
					},
				});

				// No package manager - auto-detects nested structure
				const result = await analyzeNodeModules(fixture.path);

				const parentPkg = result.packages.find(p => p.name === '@scope/parent-pkg');
				const childPkg = result.packages.find(p => p.name === 'child-pkg');

				// Scoped parent is direct dependency
				expect(parentPkg).toBeDefined();
				expect(parentPkg!.installedBy).toEqual([]);

				// Child is transitive dependency of scoped parent
				expect(childPkg).toBeDefined();
				expect(childPkg!.installedBy).toEqual([
					{
						name: '@scope/parent-pkg',
						version: '1.0.0',
					},
				]);
			});

			test('excludes nested node_modules from package size', async () => {
				// Parent has 100 bytes, child has 10,000 bytes
				// Parent size should NOT include child's size
				await using fixture = await createFixture({
					'package.json': definePackageJson({
						name: 'test-package',
						version: '1.0.0',
					}),
					node_modules: {
						'parent-pkg': {
							'package.json': definePackageJson({
								name: 'parent-pkg',
								version: '1.0.0',
							}),
							'index.js': 'x'.repeat(100),
							node_modules: {
								'child-pkg': {
									'package.json': definePackageJson({
										name: 'child-pkg',
										version: '2.0.0',
									}),
									'large-file.js': 'x'.repeat(10_000),
								},
							},
						},
					},
				});

				// No package manager - auto-detects nested structure
				const result = await analyzeNodeModules(fixture.path);

				const parentPkg = result.packages.find(p => p.name === 'parent-pkg');
				const childPkg = result.packages.find(p => p.name === 'child-pkg');

				// Parent should NOT include child's size (only ~100 bytes + package.json)
				expect(parentPkg!.size).toBeLessThan(500);
				// Child should include the large file (~10,000 bytes)
				expect(childPkg!.size).toBeGreaterThan(9000);
			});
		});
	});
});
